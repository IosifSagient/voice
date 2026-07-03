// Regression coverage for updateNote's action-item diffing (src/db.js).
// updateNote used to delete every action_items row for a note and re-insert
// fresh rows from note.action_items, hard-coding status='open' and omitting
// calendar_event_id (see CLEANUP_REPORT.md §3). It now diffs incoming items
// against existing rows by exact trimmed-text match: a matched row keeps its
// status/calendar_event_id and only has due_date/due_time/all_day updated;
// unmatched existing rows are deleted; unmatched incoming items are inserted
// fresh as 'open'. These tests document that contract.

jest.mock('expo-sqlite', () => {
  function makeSqliteMock() {
    const notes = [];
    const actionItems = [];
    const userVersion = 1; // already migrated — skip the one-time backfill trigger

    async function execAsync() {
      /* schema / PRAGMA / ALTER TABLE statements — no-op for this mock */
    }

    async function getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: userVersion };
      return null;
    }

    async function getAllAsync(sql, ...params) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) {
        return [];
      }
      if (sql.includes('SELECT id, text FROM action_items WHERE note_id')) {
        const [noteId] = params;
        return actionItems
          .filter((a) => a.note_id === noteId)
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

const { saveNote, updateNote, completeActionItem, setActionCalendarEvent, getActionItemsFiltered } = require('../src/db');

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
  it('preserves status and calendar_event_id for an unchanged action item across an edit-save', async () => {
    const noteId = await saveTestNote([{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }]);

    const [item] = [...(await itemsByText(noteId)).values()];
    await completeActionItem(item.id);
    await setActionCalendarEvent(item.id, 'cal-123');

    // Edit-form save round-trips only {text, due_date} for each action item —
    // it has no notion of status/calendar_event_id.
    await updateNote(baseNotePayload(noteId, [{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }]));

    const [updated] = [...(await itemsByText(noteId)).values()];
    expect(updated.status).toBe('done');
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

  it('treats an edited title as delete+insert, losing status/calendar_event_id', async () => {
    const noteId = await saveTestNote([{ text: 'Old title', due_date: '2025-07-10' }]);

    const [item] = [...(await itemsByText(noteId)).values()];
    await completeActionItem(item.id);
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
    await completeActionItem(first.id); // mark the 2025-07-10 one done

    // Incoming list keeps two "Duplicate" items but swaps their due dates.
    await updateNote(
      baseNotePayload(noteId, [
        { text: 'Duplicate', due_date: '2025-07-12' },
        { text: 'Duplicate', due_date: '2025-07-13' },
      ]),
    );

    const updated = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    expect(updated).toHaveLength(2);
    // No crash, no cross-contamination beyond the deterministic first-come pairing:
    // exactly one of the two rows should still carry the 'done' status picked up
    // before the edit, and every row's text is still 'Duplicate'.
    expect(updated.every((i) => i.text === 'Duplicate')).toBe(true);
    expect(updated.filter((i) => i.status === 'done')).toHaveLength(1);
  });
});
