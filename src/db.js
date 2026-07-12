// db.js — local-first persistence for notes + action items (expo-sqlite, SDK 54 async API)
import * as SQLite from "expo-sqlite";
import { normalizePersonName } from "./normalizeName";

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS notes (
    id             TEXT PRIMARY KEY NOT NULL,
    created_at     INTEGER NOT NULL,
    transcript     TEXT,
    summary        TEXT,
    people_json    TEXT,
    topics_json    TEXT,
    decisions_json TEXT
  );

  CREATE TABLE IF NOT EXISTS action_items (
    id                TEXT PRIMARY KEY NOT NULL,
    note_id           TEXT NOT NULL,
    text              TEXT NOT NULL,
    due_date          INTEGER,
    status            TEXT NOT NULL DEFAULT 'open',
    calendar_event_id TEXT,
    created_at        INTEGER NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
  CREATE INDEX IF NOT EXISTS idx_action_status ON action_items(status, due_date);
`;

// Adds columns introduced after the initial schema without breaking existing DBs.
async function migrate(db) {
  const migrations = [
    "ALTER TABLE notes ADD COLUMN companies_json TEXT",
    "ALTER TABLE action_items ADD COLUMN due_time TEXT",
    "ALTER TABLE action_items ADD COLUMN all_day INTEGER DEFAULT 1",
    "ALTER TABLE notes ADD COLUMN people_normalized_json TEXT",
    "ALTER TABLE action_items ADD COLUMN notification_id TEXT",
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch {
      /* column already exists — safe to ignore */
    }
  }

  // One-time repair for the "no honorifics in person tags" policy change: force
  // every existing note back through backfill() so people_json / people_normalized_json
  // get re-derived under the updated normalizeName rules.
  const { user_version } = await db.getFirstAsync("PRAGMA user_version");
  if (user_version < 1) {
    await db.execAsync("UPDATE notes SET people_normalized_json = NULL");
    await db.execAsync("PRAGMA user_version = 1");
  }

  // One-time repair for the products/companies → single "topics" field merge:
  // fold companies_json into topics_json, then drop the now-unused column.
  if (user_version < 2) {
    const rows = await db.getAllAsync("SELECT id, topics_json, companies_json FROM notes");
    for (const row of rows) {
      try {
        const merged = [
          ...JSON.parse(row.topics_json || "[]"),
          ...JSON.parse(row.companies_json || "[]"),
        ];
        await db.runAsync(
          "UPDATE notes SET topics_json = ? WHERE id = ?",
          JSON.stringify(merged),
          row.id,
        );
      } catch (err) {
        // A single malformed row must not fail the whole migration — skip it
        // and keep going so every other note still gets repaired.
        console.error(`[db:migrate] failed to merge topics/companies for note ${row.id}, skipping`, err);
      }
    }
    try {
      await db.execAsync("ALTER TABLE notes DROP COLUMN companies_json");
    } catch {
      /* older SQLite without DROP COLUMN support — column stays, just unused */
    }
    await db.execAsync("PRAGMA user_version = 2");
  }
}

export async function backfill(db) {
  const rows = await db.getAllAsync(
    "SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL",
  );
  for (const row of rows) {
    try {
      const raw = JSON.parse(row.people_json || "[]");
      const normalized = normalizeAndDedupeNames(raw);
      await db.runAsync(
        "UPDATE notes SET people_json = ?, people_normalized_json = ? WHERE id = ?",
        JSON.stringify(normalized.map((n) => n.display)),
        JSON.stringify(normalized),
        row.id,
      );
    } catch (err) {
      // A single malformed row (e.g. corrupt people_json) must not fail the
      // whole init chain — skip it and keep going so other rows still backfill.
      console.error(`[db:backfill] failed to backfill note ${row.id}, skipping`, err);
    }
  }
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    // If this chain rejects (e.g. a migration throws), clear dbPromise so the
    // NEXT call starts a fresh attempt instead of every future db call
    // re-awaiting the same cached rejection for the rest of the session.
    // Callers already in flight when it rejects all see the same rejection —
    // only one openDatabaseAsync() happens per failed attempt.
    dbPromise = SQLite.openDatabaseAsync("voicenote_v2.db")
      .then(async (db) => {
        await db.execAsync(SCHEMA);
        await migrate(db);
        await backfill(db);
        return db;
      })
      .catch((err) => {
        dbPromise = null;
        throw err;
      });
  }
  return dbPromise;
}

// Called once at App startup — just ensures the DB is ready before any render.
export async function initDb() {
  await getDb();
}

// Always convert a YYYY-MM-DD (or YYYY-MM-DDTHH:MM:SS...) string to UTC midnight.
// Using Date.UTC avoids local-timezone shifts that cause off-by-one day bugs.
export function parseDueDate(str) {
  if (!str) return null;
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

// Normalizes each raw name via normalizePersonName, deduping by key (first occurrence wins).
// Exported so the dedup logic can be unit-tested without a SQLite dependency.
//
// Field order matters here: this object is JSON.stringify'd into people_normalized_json,
// and getNotesByTag's person-tag lookup does a LIKE '%"key":"..."%' match against that
// string — it depends on "key" serializing as the first field. Do not reorder these two
// fields without checking the read site (search for "LIKE" in this file).
export function normalizeAndDedupeNames(rawNames) {
  const seen = new Map();
  for (const name of rawNames) {
    if (typeof name !== "string" || !name.trim()) continue;
    const { key, display } = normalizePersonName(name);
    if (!seen.has(key)) seen.set(key, { key, display });
  }
  return [...seen.values()];
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- WRITE -----------------------------------------------------------------

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
    await db.runAsync(
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
    await db.runAsync("DELETE FROM notes WHERE id = ?", id);
  });
  return rows.map((r) => ({
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
  }));
}

export async function completeActionItem(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE action_items SET status = 'done' WHERE id = ?`, id);
}

export async function setActionCalendarEvent(id, calendarEventId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE action_items SET calendar_event_id = ? WHERE id = ?`,
    calendarEventId,
    id,
  );
}

export async function setActionNotificationId(id, notificationId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE action_items SET notification_id = ? WHERE id = ?`,
    notificationId,
    id,
  );
}

// --- READ ------------------------------------------------------------------

export async function getNote(id) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT * FROM notes WHERE id = ?", id);
  if (!row) return null;
  const note = hydrateNote(row);
  const items = await db.getAllAsync(
    `SELECT id, text, due_date, due_time, all_day, status, calendar_event_id, notification_id
     FROM action_items WHERE note_id = ? AND status = 'open' ORDER BY created_at`,
    id,
  );
  note.action_items = items.map((r) => ({
    id: r.id,
    text: r.text,
    due_date: r.due_date
      ? new Date(r.due_date).toISOString().slice(0, 10)
      : null,
    due_time: r.due_time ?? null,
    all_day: r.all_day !== 0,
    status: r.status,
    calendar_event_id: r.calendar_event_id ?? null,
    notification_id: r.notification_id ?? null,
  }));
  return note;
}

export async function getRecentNotes(limit = 20) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     ORDER BY notes.created_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(hydrateNote);
}

export async function searchNotes(query, limit = 10) {
  const db = await getDb();
  const like = `%${query}%`;
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     WHERE notes.transcript LIKE ? OR notes.summary LIKE ? OR notes.people_json LIKE ? OR notes.topics_json LIKE ?
     ORDER BY notes.created_at DESC LIMIT ?`,
    like,
    like,
    like,
    like,
    limit,
  );
  return rows.map(hydrateNote);
}

// --- agent query helpers ---------------------------------------------------

export async function getActionItemsFiltered({
  status,
  dueBefore,
  dueAfter,
} = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }
  if (dueBefore) {
    const ts = parseDueDate(dueBefore);
    if (ts != null) {
      // inclusive: end of that day
      conditions.push("a.due_date IS NOT NULL AND a.due_date <= ?");
      params.push(ts + 86400000 - 1);
    }
  }
  if (dueAfter) {
    const ts = parseDueDate(dueAfter);
    if (ts != null) {
      conditions.push("(a.due_date IS NULL OR a.due_date > ?)");
      params.push(ts + 86400000 - 1);
    }
  }

  const where =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const rows = await db.getAllAsync(
    `SELECT a.id, a.text, a.due_date, a.due_time, a.all_day, a.status,
       a.calendar_event_id, a.notification_id, a.created_at, a.note_id,
       n.summary AS note_summary, n.people_json
     FROM action_items a
     JOIN notes n ON a.note_id = n.id
     ${where}
     ORDER BY (a.due_date IS NULL), a.due_date ASC
     LIMIT 50`,
    ...params,
  );
  return rows.map((r) => ({
    id: r.id,
    noteId: r.note_id,
    text: r.text,
    dueDate: r.due_date
      ? new Date(r.due_date).toISOString().slice(0, 10)
      : null,
    dueTime: r.due_time ?? null,
    allDay: r.all_day !== 0,
    status: r.status,
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
    createdAt: r.created_at,
    noteSummary: r.note_summary ?? "",
    notePeople: safeParseArray(r.people_json, r.note_id, "people_json"),
  }));
}

// All open action items with a due_date, joined with parent note context.
// No date-bucket filtering here — that's done in the service layer
// (src/services/taskBuckets.ts) so the boundary logic is testable in JS.
export async function getTasksWithDueDates() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT a.id, a.text, a.due_date, a.due_time, a.all_day, a.status,
       a.calendar_event_id, a.notification_id, a.created_at, a.note_id,
       n.summary AS note_summary, n.people_json
     FROM action_items a
     JOIN notes n ON a.note_id = n.id
     WHERE a.status = 'open' AND a.due_date IS NOT NULL
     ORDER BY a.due_date ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    noteId: r.note_id,
    text: r.text,
    dueDate: new Date(r.due_date).toISOString().slice(0, 10),
    dueTime: r.due_time ?? null,
    allDay: r.all_day !== 0,
    status: r.status,
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
    createdAt: r.created_at,
    noteSummary: r.note_summary ?? "",
    notePeople: safeParseArray(r.people_json, r.note_id, "people_json"),
  }));
}

export async function getNotesByDateRange(from, to) {
  const db = await getDb();
  const fromTs = parseDueDate(from);
  const toTs = parseDueDate(to);
  if (fromTs == null || toTs == null) return [];
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     WHERE notes.created_at >= ? AND notes.created_at < ?
     ORDER BY notes.created_at DESC LIMIT 50`,
    fromTs,
    toTs + 86400000,
  );
  return rows.map(hydrateNote);
}

export async function getNotesByTag(tagType, value) {
  const db = await getDb();

  if (tagType === "person") {
    // people_normalized_json stores {"key":...,"display":...} with key first;
    // if the object shape changes, this LIKE pattern breaks silently.
    const keyLike = `%"key":"${normalizePersonName(value).key}"%`;
    const rows = await db.getAllAsync(
      `SELECT notes.*,
         (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
       FROM notes
       WHERE notes.people_normalized_json LIKE ?
       ORDER BY notes.created_at DESC LIMIT 20`,
      keyLike,
    );
    return rows.map(hydrateNote);
  }

  const columnMap = {
    topic: "topics_json",
  };
  const column = columnMap[tagType];
  if (!column) return [];
  const like = `%${value}%`;
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     WHERE notes.${column} LIKE ?
     ORDER BY notes.created_at DESC LIMIT 20`,
    like,
  );
  return rows.map(hydrateNote);
}

export async function getRecentNotesByDays(days = 7) {
  const db = await getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     WHERE notes.created_at >= ?
     ORDER BY notes.created_at DESC LIMIT 50`,
    since,
  );
  return rows.map(hydrateNote);
}

export async function reopenActionItem(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE action_items SET status = 'open' WHERE id = ?`, id);
}

export async function deleteActionItem(id) {
  const db = await getDb();
  let row;
  // Same atomicity concern as deleteNote — read-then-delete must not straddle
  // a concurrent write.
  await db.withTransactionAsync(async () => {
    row = await db.getFirstAsync(
      `SELECT calendar_event_id, notification_id FROM action_items WHERE id = ?`,
      id,
    );
    if (row) {
      await db.runAsync(`DELETE FROM action_items WHERE id = ?`, id);
    }
  });
  if (!row) return null;
  return {
    calendarEventId: row.calendar_event_id ?? null,
    notificationId: row.notification_id ?? null,
  };
}

// --- helpers ---------------------------------------------------------------

// Parses a stored JSON array column, tolerating a malformed value from a
// single bad row (e.g. corrupted people_json) without failing the whole
// query for every other row — mirrors backfill()'s per-row resilience.
function safeParseArray(json, noteId, field) {
  try {
    return JSON.parse(json || "[]");
  } catch (err) {
    console.error(`[db:hydrateNote] failed to parse ${field} for note ${noteId}, defaulting to []`, err);
    return [];
  }
}

export function hydrateNote(row) {
  return {
    id: row.id,
    timestamp: row.created_at,
    transcript: row.transcript,
    summary: row.summary,
    people: safeParseArray(row.people_json, row.id, "people_json"),
    topics: safeParseArray(row.topics_json, row.id, "topics_json"),
    decisions: safeParseArray(row.decisions_json, row.id, "decisions_json"),
    action_items: [],
    openActionCount: row.open_count ?? 0,
  };
}
