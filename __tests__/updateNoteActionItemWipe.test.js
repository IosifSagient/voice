// KNOWN BUG (see CLEANUP_REPORT.md §3): updateNote (src/db.js) deletes every
// action_items row for a note and re-inserts fresh rows from note.action_items,
// hard-coding status='open' and omitting calendar_event_id (defaults to NULL).
// Any action item that was previously completed, or linked to a calendar event,
// loses both fields the moment its parent note is edited — even if the edit
// never touched that action item's text or due date.
// This test documents the bug. It is skipped until src/db.js:172-204 is fixed
// to preserve existing status/calendar_event_id for unchanged action items.

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

    async function getAllAsync(sql) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) {
        return [];
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
      } else if (sql.includes('DELETE FROM action_items WHERE note_id')) {
        const noteId = params[0];
        for (let i = actionItems.length - 1; i >= 0; i--) {
          if (actionItems[i].note_id === noteId) actionItems.splice(i, 1);
        }
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

describe('updateNote — known bug: wipes action-item status/calendar_event_id', () => {
  it.skip('preserves status and calendar_event_id for an unchanged action item across an edit-save', async () => {
    const noteId = await saveNote(
      {
        summary: 'Πρέπει να καλέσω τον υδραυλικό',
        people: [],
        topics: [],
        action_items: [{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }],
      },
      'Πρέπει να καλέσω τον υδραυλικό.',
    );

    const [item] = await getActionItemsFiltered({});
    await completeActionItem(item.id);
    await setActionCalendarEvent(item.id, 'cal-123');

    // Edit-form save round-trips only {text, due_date} for each action item —
    // it has no notion of status/calendar_event_id.
    await updateNote({
      id: noteId,
      transcript: 'Πρέπει να καλέσω τον υδραυλικό.',
      summary: 'Πρέπει να καλέσω τον υδραυλικό',
      people: [],
      topics: [],
      decisions: [],
      action_items: [{ text: 'Κάλεσε υδραυλικό', due_date: '2025-07-10' }],
    });

    const [updated] = await getActionItemsFiltered({});
    expect(updated.status).toBe('done');
    expect(updated.calendarEventId).toBe('cal-123');
  });
});
