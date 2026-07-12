// Regression coverage for deleteNote's cascade cleanup (src/db.js).
// deleteNote used to just DELETE FROM notes and rely on the notes<-action_items
// FK's ON DELETE CASCADE to remove the child action_items rows — but nothing
// ever surfaced those rows' calendar_event_id/notification_id first, so any
// reminder tied to them was silently orphaned. deleteNote() now fetches them
// before the cascade and returns them so the caller can cancel both.

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
      if (sql.includes('SELECT calendar_event_id, notification_id FROM action_items WHERE note_id')) {
        const [noteId] = params;
        return actionItems
          .filter((a) => a.note_id === noteId)
          .map((a) => ({ calendar_event_id: a.calendar_event_id, notification_id: a.notification_id }));
      }
      // getActionItemsFiltered's query — used by the tests below to inspect state.
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
            notification_id: a.notification_id,
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
        actionItems.push({ id, note_id, text, due_date, due_time, all_day, status: 'open', calendar_event_id: null, notification_id: null, created_at });
      } else if (sql.includes('UPDATE action_items SET calendar_event_id')) {
        const [calendarEventId, id] = params;
        const row = actionItems.find((a) => a.id === id);
        if (row) row.calendar_event_id = calendarEventId;
      } else if (sql.includes('UPDATE action_items SET notification_id')) {
        const [notificationId, id] = params;
        const row = actionItems.find((a) => a.id === id);
        if (row) row.notification_id = notificationId;
      } else if (sql.includes("UPDATE action_items SET status = 'done'")) {
        const row = actionItems.find((a) => a.id === params[0]);
        if (row) row.status = 'done';
      } else if (sql.includes('DELETE FROM notes WHERE id')) {
        // Simulates the real schema's `ON DELETE CASCADE` FK on action_items.note_id.
        const noteId = params[0];
        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx !== -1) notes.splice(idx, 1);
        for (let i = actionItems.length - 1; i >= 0; i--) {
          if (actionItems[i].note_id === noteId) actionItems.splice(i, 1);
        }
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
  saveNote, deleteNote, setActionCalendarEvent, setActionNotificationId,
  completeActionItem, getActionItemsFiltered,
} = require('../src/db');

function saveTestNote(actionItems) {
  return saveNote({ summary: 's', people: [], topics: [], action_items: actionItems }, 't');
}

describe('deleteNote — cascade reminder cleanup', () => {
  it('returns the calendar/notification ids of every child action item before the cascade delete', async () => {
    const noteId = await saveTestNote([
      { text: 'Call the plumber', due_date: '2025-07-10' },
      { text: 'Buy milk', due_date: '2025-07-11' },
    ]);
    const items = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    await setActionCalendarEvent(items[0].id, 'cal-1');
    await setActionNotificationId(items[0].id, 'notif-1');
    // second item has no calendar reminder but does have a notification

    await setActionNotificationId(items[1].id, 'notif-2');

    const reminders = await deleteNote(noteId);

    expect(reminders).toHaveLength(2);
    expect(reminders).toEqual(
      expect.arrayContaining([
        { calendarEventId: 'cal-1', notificationId: 'notif-1' },
        { calendarEventId: null, notificationId: 'notif-2' },
      ]),
    );
  });

  it('captures reminder ids for a completed (done) child too, not just open items', async () => {
    const noteId = await saveTestNote([{ text: 'Already handled', due_date: '2025-07-10' }]);
    const [item] = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    await setActionCalendarEvent(item.id, 'cal-done');
    await setActionNotificationId(item.id, 'notif-done');
    await completeActionItem(item.id);

    const reminders = await deleteNote(noteId);

    expect(reminders).toEqual([{ calendarEventId: 'cal-done', notificationId: 'notif-done' }]);
  });

  it('actually deletes the note and its action items', async () => {
    const noteId = await saveTestNote([{ text: 'Call the plumber', due_date: '2025-07-10' }]);

    await deleteNote(noteId);

    const remaining = (await getActionItemsFiltered({})).filter((i) => i.noteId === noteId);
    expect(remaining).toHaveLength(0);
  });

  it('returns an empty array for a note with no action items', async () => {
    const noteId = await saveTestNote([]);

    const reminders = await deleteNote(noteId);

    expect(reminders).toEqual([]);
  });
});
