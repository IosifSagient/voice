// Regression coverage for updateNote's action-item diffing (src/db.js).
// updateNote used to delete every action_items row for a note and re-insert
// fresh rows from note.action_items, hard-coding status='open' and omitting
// calendar_event_id (see CLEANUP_REPORT.md §3). It now diffs incoming items
// against existing OPEN rows by exact trimmed-text match: a matched row keeps
// its calendar_event_id and only has due_date/due_time/all_day updated;
// unmatched existing (open) rows are deleted; unmatched incoming items are
// inserted fresh as 'open'. Done rows are scoped out of the existing-rows
// query entirely (mirroring getNote(), which only ever returns open items) —
// they are never matched, updated, or deleted by an edit-save. These tests
// document that contract.

jest.mock('expo-sqlite', () => {
  function makeSqliteMock() {
    const notes = [];
    const actionItems = [];
    const userVersion = 1; // already migrated — skip the one-time backfill trigger

    async function execAsync() {
      /* schema / PRAGMA / ALTER TABLE statements — no-op for this mock */
    }

    async function getFirstAsync(sql, ...params) {
      if (sql.includes('PRAGMA user_version')) return { user_version: userVersion };
      if (sql.includes('SELECT * FROM notes WHERE id = ?')) {
        const [id] = params;
        return notes.find((n) => n.id === id) ?? null;
      }
      return null;
    }

    async function getAllAsync(sql, ...params) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) {
        return [];
      }
      // getNote()'s action-items query — only ever returns open items, same as prod.
      if (sql.includes('FROM action_items WHERE note_id = ? AND status = \'open\' ORDER BY created_at')) {
        const [noteId] = params;
        return actionItems
          .filter((a) => a.note_id === noteId && a.status === 'open')
          .map((a) => ({
            id: a.id,
            text: a.text,
            due_date: a.due_date,
            due_time: a.due_time,
            all_day: a.all_day,
            status: a.status,
            calendar_event_id: a.calendar_event_id,
          }));
      }
      // updateNote()'s existing-rows query — scoped to status='open' in prod code;
      // honor that scoping here too so this mock actually distinguishes the fixed
      // behavior from the old (unscoped) one instead of masking it.
      if (sql.includes('SELECT id, text FROM action_items WHERE note_id')) {
        const openOnly = sql.includes("status = 'open'");
        const [noteId] = params;
        return actionItems
          .filter((a) => a.note_id === noteId && (!openOnly || a.status === 'open'))
          .map((a) => ({ id: a.id, text: a.text }));
      }
      if (sql.includes('FROM action_items a') && sql.includes('JOIN notes n')) {
        return actionItems.map((a) => {
          const note = notes.find((n) => n.id === a.note_id);
          return {
            id: a.id,
            text: a.text,
            due_date: a.due_date,
            due_time: a.due_time,
            all_day: a.all_day,
            status: a.status,
            calendar_event_id: a.calendar_event_id,
            created_at: a.created_at,
            note_id: a.note_id,
            note_summary: note?.summary ?? '',
            people_json: note?.people_json ?? '[]',
          };
        });
      }
      return [];
    }

    async function runAsync(sql, ...params) {
      if (sql.includes('INSERT INTO notes')) {
        const [
          id, created_at, transcript, summary,
          people_json, topics_json, decisions_json, people_normalized_json,
        ] = params;
        notes.push({ id, created_at, transcript, summary, people_json, topics_json, decisions_json, people_normalized_json });
      } else if (sql.includes('INSERT INTO action_items')) {
        const [id, note_id, text, due_date, due_time, all_day, created_at] = params;
        actionItems.push({ id, note_id, text, due_date, due_time, all_day, status: 'open', calendar_event_id: null, created_at });
      } else if (sql.startsWith('UPDATE notes SET transcript')) {
        const id = params[params.length - 1];
        const row = notes.find((n) => n.id === id);
        if (row) {
          const [transcript, summary, people_json, topics_json, decisions_json, people_normalized_json] = params;
          Object.assign(row, { transcript, summary, people_json, topics_json, decisions_json, people_normalized_json });
        }
      } else if (sql.startsWith('UPDATE action_items SET text')) {
        const [text, due_date, due_time, all_day, id] = params;
        const row = actionItems.find((a) => a.id === id);
        if (row) Object.assign(row, { text, due_date, due_time, all_day });
      } else if (sql.includes('DELETE FROM action_items WHERE note_id')) {
        const noteId = params[0];
        for (let i = actionItems.length - 1; i >= 0; i--) {
          if (actionItems[i].note_id === noteId) actionItems.splice(i, 1);
        }
      } else if (sql.includes('DELETE FROM action_items WHERE id')) {
        const id = params[0];
        const idx = actionItems.findIndex((a) => a.id === id);
        if (idx !== -1) actionItems.splice(idx, 1);
      } else if (sql.includes("UPDATE action_items SET status = 'done'")) {
        const row = actionItems.find((a) => a.id === params[0]);
        if (row) row.status = 'done';
      } else if (sql.includes('UPDATE action_items SET calendar_event_id')) {
        const [calendarEventId, id] = params;
        const row = actionItems.find((a) => a.id === id);
        if (row) row.calendar_event_id = calendarEventId;
      }
      return { changes: 1 };
    }

    async function withTransactionAsync(fn) {
      await fn();
    }

    return { execAsync, getFirstAsync, getAllAsync, runAsync, withTransactionAsync };
  }

  const instance = makeSqliteMock();
  return {
    openDatabaseAsync: jest.fn(() => Promise.resolve(instance)),
  };
});

const {
  saveNote, updateNote, getNote, completeActionItem, setActionCalendarEvent, getActionItemsFiltered,
} = require('../src/db');
const { copyNote } = require('../src/types/note');

function saveTestNote(actionItems) {
  return saveNote({ summary: 's', people: [], topics: [], action_items: actionItems }, 't');
}

function baseNotePayload(noteId, actionItems) {
  return { id: noteId, transcript: 't', summary: 's', people: [], topics: [], decisions: [], action_items: actionItems };
}

// getActionItemsFiltered({}) returns items across every note saved in this file's
// shared mock DB, so scope lookups to the note under test.
async function itemsByText(noteId) {
  const items = await getActionItemsFiltered({});
  return new Map(items.filter((i) => i.noteId === noteId).map((i) => [i.text, i]));
}

describe('updateNote — action-item diffing', () => {
  it('preserves calendar_event_id for an unchanged open action item across an edit-save', async () => {
    const noteId = await saveTestNote([{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }]);

    const [item] = [...(await itemsByText(noteId)).values()];
    await setActionCalendarEvent(item.id, 'cal-123');

    // Edit-form save round-trips only {text, due_date} for each action item —
    // it has no notion of status/calendar_event_id.
    await updateNote(baseNotePayload(noteId, [{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }]));

    const [updated] = [...(await itemsByText(noteId)).values()];
    expect(updated.status).toBe('open');
    expect(updated.calendarEventId).toBe('cal-123');
  });

  it('inserts an unmatched incoming item as a new open item', async () => {
    const noteId = await saveTestNote([{ text: 'Existing item', due_date: '2025-07-10' }]);

    await updateNote(
      baseNotePayload(noteId, [
        { text: 'Existing item', due_date: '2025-07-10' },
        { text: 'Brand new item', due_date: '2025-07-11' },
      ]),
    );

    const byText = await itemsByText(noteId);
    expect(byText.size).toBe(2);
    expect(byText.get('Brand new item').status).toBe('open');
    expect(byText.get('Brand new item').calendarEventId).toBeNull();
  });

  it('deletes an existing item that has no match in the incoming list', async () => {
    const noteId = await saveTestNote([
      { text: 'Keep me', due_date: '2025-07-10' },
      { text: 'Remove me', due_date: '2025-07-11' },
    ]);

    await updateNote(baseNotePayload(noteId, [{ text: 'Keep me', due_date: '2025-07-10' }]));

    const byText = await itemsByText(noteId);
    expect(byText.size).toBe(1);
    expect(byText.has('Remove me')).toBe(false);
    expect(byText.has('Keep me')).toBe(true);
  });

  it('treats an edited title as delete+insert, losing calendar_event_id', async () => {
    const noteId = await saveTestNote([{ text: 'Old title', due_date: '2025-07-10' }]);

    const [item] = [...(await itemsByText(noteId)).values()];
    await setActionCalendarEvent(item.id, 'cal-456');

    await updateNote(baseNotePayload(noteId, [{ text: 'New title', due_date: '2025-07-10' }]));

    const byText = await itemsByText(noteId);
    expect(byText.has('Old title')).toBe(false);
    const renamed = byText.get('New title');
    expect(renamed).toBeDefined();
    expect(renamed.status).toBe('open');
    expect(renamed.calendarEventId).toBeNull();
  });

  it('pairs duplicate texts first-come-first-served without cross-matching', async () => {
    const noteId = await saveTestNote([
      { text: 'Duplicate', due_date: '2025-07-10' },
      { text: 'Duplicate', due_date: '2025-07-11' },
    ]);

    // Both items share the text 'Duplicate', so itemsByText's Map would collapse
    // them — fetch the raw list instead for this test.
    const raw = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    expect(raw).toHaveLength(2);
    const [first] = raw.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    await setActionCalendarEvent(first.id, 'cal-dup'); // tag the 2025-07-10 row

    // Incoming list keeps two "Duplicate" items but swaps their due dates.
    await updateNote(
      baseNotePayload(noteId, [
        { text: 'Duplicate', due_date: '2025-07-12' },
        { text: 'Duplicate', due_date: '2025-07-13' },
      ]),
    );

    const updated = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    expect(updated).toHaveLength(2);
    expect(updated.every((i) => i.text === 'Duplicate')).toBe(true);
    // The row created first (which carried the calendar link) pairs with the
    // first incoming duplicate — its calendar_event_id survives the edit, proving
    // first-come-first-served pairing rather than cross-matching.
    const linked = updated.find((i) => i.calendarEventId === 'cal-dup');
    expect(linked).toBeDefined();
    expect(linked.dueDate).toBe('2025-07-12');
  });

  it('leaves a done action item completely untouched across the real getNote -> edit -> updateNote pipeline', async () => {
    const noteId = await saveTestNote([
      { text: 'Still open', due_date: '2025-07-10' },
      { text: 'Already done', due_date: '2025-07-11' },
    ]);

    const beforeEdit = await itemsByText(noteId);
    const doneItem = beforeEdit.get('Already done');
    await completeActionItem(doneItem.id);
    await setActionCalendarEvent(doneItem.id, 'cal-789');

    // This mirrors NoteDetailScreen exactly: load via getNote() (open items only),
    // then copyNote() to build the edit draft — the done item is invisible to both.
    const note = await getNote(noteId);
    expect(note.action_items.map((i) => i.text)).toEqual(['Still open']);
    const draft = copyNote(note);

    // User edits only the summary and saves without touching action items at all.
    draft.summary = 'Edited summary';
    await updateNote(draft);

    const afterSave = await itemsByText(noteId);
    expect(afterSave.has('Already done')).toBe(true);
    const stillDone = afterSave.get('Already done');
    expect(stillDone.status).toBe('done');
    expect(stillDone.calendarEventId).toBe('cal-789');
    expect(afterSave.has('Still open')).toBe(true);
  });
});
