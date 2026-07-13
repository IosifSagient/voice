import { getDb } from "./connection";
import { parseDueDate, normalizeAndDedupeNames } from "./shared";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveNote(extraction, transcript) {
  const db = await getDb();
  const noteId = uuid();
  const now = Date.now();
  const {
    summary = "",
    people = [],
    topics = [],
    action_items = [],
  } = extraction || {};
  const normalizedPeople = normalizeAndDedupeNames(people);

  await db.withTransactionAsync(async () => {
    const insertResult = await db.runAsync(
      `INSERT INTO notes (id, created_at, transcript, summary, people_json, topics_json, decisions_json, people_normalized_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      noteId,
      now,
      transcript ?? "",
      summary,
      JSON.stringify(normalizedPeople.map((n) => n.display)),
      JSON.stringify(topics),
      JSON.stringify([]),
      JSON.stringify(normalizedPeople),
    );

    // Search sync must never fail the user-facing save — a broken index entry
    // just means this note won't turn up in search, not a lost note.
    try {
      await db.runAsync(
        `INSERT INTO notes_fts (rowid, transcript, summary) VALUES (?, ?, ?)`,
        insertResult.lastInsertRowId,
        transcript ?? "",
        summary,
      );
    } catch (err) {
      console.error(`[db:saveNote] failed to sync notes_fts for note ${noteId}, skipping`, err);
    }

    for (const item of action_items) {
      const due = parseDueDate(item?.due_date);
      await db.runAsync(
        `INSERT INTO action_items (id, note_id, text, due_date, due_time, all_day, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
        uuid(),
        noteId,
        item.text ?? "",
        Number.isFinite(due) ? due : null,
        item.due_time ?? null,
        item.all_day === false ? 0 : 1,
        now,
      );
    }
  });

  return noteId;
}

// Returns a diff of what happened to each existing (open) action item's
// calendar/notification reminders across the edit, so the caller can cancel
// or reschedule them — db.js itself never touches expo-calendar/expo-notifications:
//   removed: rows deleted outright (no match in the incoming list) OR deleted
//            as part of an edited-title's delete+insert — either way their old
//            reminder ids must be cancelled, since nothing else in the app has
//            them anymore once this transaction commits.
//   changed: matched rows whose due_date/due_time/all_day actually changed —
//            their existing reminder ids must be cancelled and a new one
//            scheduled from `item` (the fresh values), if the caller wants to.
// A matched row with no relevant change is omitted from `changed` entirely so
// a no-op save doesn't trigger a pointless reschedule.
export async function updateNote(note) {
  const db = await getDb();
  const now = Date.now();
  const normalizedPeople = normalizeAndDedupeNames(note.people || []);
  const removed = [];
  const changed = [];
  await db.withTransactionAsync(async () => {
    // Fetched before the UPDATE so the FTS sync below can issue the
    // external-content 'delete' command with the OLD transcript/summary —
    // FTS5 needs the old column values, not just the rowid, to remove a row
    // from the index cleanly.
    const oldNote = await db.getFirstAsync(
      `SELECT rowid, transcript, summary FROM notes WHERE id = ?`,
      note.id,
    );

    await db.runAsync(
      `UPDATE notes SET transcript = ?, summary = ?, people_json = ?, topics_json = ?, decisions_json = ?, people_normalized_json = ? WHERE id = ?`,
      note.transcript ?? "",
      note.summary ?? "",
      JSON.stringify(normalizedPeople.map((n) => n.display)),
      JSON.stringify(note.topics || []),
      JSON.stringify(note.decisions || []),
      JSON.stringify(normalizedPeople),
      note.id,
    );

    // Search sync must never fail the user-facing save (same stance as
    // saveNote) — each statement is its own try/catch so a failed 'delete'
    // doesn't stop the fresh insert from being attempted.
    if (oldNote) {
      try {
        await db.runAsync(
          `INSERT INTO notes_fts (notes_fts, rowid, transcript, summary) VALUES ('delete', ?, ?, ?)`,
          oldNote.rowid,
          oldNote.transcript ?? "",
          oldNote.summary ?? "",
        );
      } catch (err) {
        console.error(`[db:updateNote] failed to remove stale notes_fts entry for note ${note.id}, skipping`, err);
      }
      try {
        await db.runAsync(
          `INSERT INTO notes_fts (rowid, transcript, summary) VALUES (?, ?, ?)`,
          oldNote.rowid,
          note.transcript ?? "",
          note.summary ?? "",
        );
      } catch (err) {
        console.error(`[db:updateNote] failed to sync notes_fts for note ${note.id}, skipping`, err);
      }
    }

    // Scoped to status='open' to mirror getNote(), which only ever returns open
    // action items — done items are outside the editor's contract (it never saw
    // them, so it can't have "removed" them) and must stay completely untouched
    // by this diff: not matched, not updated, not deleted.
    const existing = await db.getAllAsync(
      `SELECT id, text, due_date, due_time, all_day, calendar_event_id, notification_id
       FROM action_items WHERE note_id = ? AND status = 'open'`,
      note.id,
    );

    // Pair incoming items to existing rows by exact trimmed-text match so a matched
    // row keeps its status/calendar_event_id across the edit; unmatched existing
    // rows are deleted and unmatched incoming items are inserted fresh. An edited
    // title has no match under this rule and is therefore treated as delete+insert
    // — the item loses its status/calendar link, but the caller is handed the old
    // reminder ids (via `removed`) so it can cancel them before they're orphaned.
    // Duplicate texts within one note are paired first-come-first-served (the Nth
    // existing row with a given text pairs with the Nth incoming item with that
    // text) rather than cross-matched — good enough since duplicate action-item
    // text is a rare edge case, not the common path.
    const availableByText = new Map();
    for (const row of existing) {
      const key = (row.text ?? "").trim();
      if (!availableByText.has(key)) availableByText.set(key, []);
      availableByText.get(key).push(row);
    }

    const matchedIds = new Set();
    const plan = (note.action_items || []).map((item) => {
      const key = (item.text ?? "").trim();
      const bucket = availableByText.get(key);
      const match = bucket && bucket.length ? bucket.shift() : null;
      if (match) matchedIds.add(match.id);
      return { item, match };
    });

    for (const row of existing) {
      if (!matchedIds.has(row.id)) {
        removed.push({
          calendarEventId: row.calendar_event_id ?? null,
          notificationId: row.notification_id ?? null,
        });
        await db.runAsync("DELETE FROM action_items WHERE id = ?", row.id);
      }
    }

    for (const { item, match } of plan) {
      const due = parseDueDate(item?.due_date);
      const dueTime = item.due_time ?? null;
      const allDay = item.all_day === false ? 0 : 1;
      if (match) {
        const dueChanged =
          (Number.isFinite(due) ? due : null) !== (match.due_date ?? null) ||
          dueTime !== (match.due_time ?? null) ||
          allDay !== (match.all_day ?? 1);
        if (dueChanged) {
          changed.push({
            id: match.id,
            calendarEventId: match.calendar_event_id ?? null,
            notificationId: match.notification_id ?? null,
            item: { ...item, id: match.id },
          });
        }
        await db.runAsync(
          `UPDATE action_items SET text = ?, due_date = ?, due_time = ?, all_day = ? WHERE id = ?`,
          item.text ?? "",
          Number.isFinite(due) ? due : null,
          dueTime,
          allDay,
          match.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO action_items (id, note_id, text, due_date, due_time, all_day, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
          uuid(),
          note.id,
          item.text ?? "",
          Number.isFinite(due) ? due : null,
          dueTime,
          allDay,
          now,
        );
      }
    }
  });

  return { removed, changed };
}

// Returns the calendar/notification reminder ids of every action item under
// this note (about to be cascade-deleted via the notes<-action_items FK) so
// the caller can cancel them — the cascade itself does not, and previously
// nothing did.
export async function deleteNote(id) {
  const db = await getDb();
  let rows;
  // SELECT + cascading DELETE must be atomic — otherwise a concurrent write
  // landing between them could change which action items exist by the time
  // the cascade fires, and the ids we return would no longer match reality.
  await db.withTransactionAsync(async () => {
    rows = await db.getAllAsync(
      `SELECT calendar_event_id, notification_id FROM action_items WHERE note_id = ?`,
      id,
    );

    const oldNote = await db.getFirstAsync(
      `SELECT rowid, transcript, summary FROM notes WHERE id = ?`,
      id,
    );
    if (oldNote) {
      try {
        await db.runAsync(
          `INSERT INTO notes_fts (notes_fts, rowid, transcript, summary) VALUES ('delete', ?, ?, ?)`,
          oldNote.rowid,
          oldNote.transcript ?? "",
          oldNote.summary ?? "",
        );
      } catch (err) {
        console.error(`[db:deleteNote] failed to remove notes_fts entry for note ${id}, skipping`, err);
      }
    }

    await db.runAsync("DELETE FROM notes WHERE id = ?", id);
  });
  return rows.map((r) => ({
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
  }));
}
