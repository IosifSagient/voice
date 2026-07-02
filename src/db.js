// db.js — local-first persistence for notes + action items (expo-sqlite, SDK 54 async API)
import * as SQLite from "expo-sqlite";

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
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch {
      /* column already exists — safe to ignore */
    }
  }
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("voicenote_v2.db").then(async (db) => {
      await db.execAsync(SCHEMA);
      await migrate(db);
      return db;
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
function parseDueDate(str) {
  if (!str) return null;
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
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
    products = [], // new field; stored in topics_json column
    companies = [], // new field; stored in companies_json column
    action_items = [],
  } = extraction || {};

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO notes (id, created_at, transcript, summary, people_json, topics_json, decisions_json, companies_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      noteId,
      now,
      transcript ?? "",
      summary,
      JSON.stringify(people),
      JSON.stringify(products),
      JSON.stringify([]),
      JSON.stringify(companies),
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

export async function updateNote(note) {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE notes SET transcript = ?, summary = ?, people_json = ?, topics_json = ?, decisions_json = ?, companies_json = ? WHERE id = ?`,
      note.transcript ?? "",
      note.summary ?? "",
      JSON.stringify(note.people || []),
      JSON.stringify(note.topics || []), // edit form writes topics → stored as products
      JSON.stringify(note.decisions || []),
      JSON.stringify(note.companies || []),
      note.id,
    );
    await db.runAsync("DELETE FROM action_items WHERE note_id = ?", note.id);
    for (const item of note.action_items || []) {
      const due = parseDueDate(item?.due_date);
      await db.runAsync(
        `INSERT INTO action_items (id, note_id, text, due_date, due_time, all_day, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
        uuid(),
        note.id,
        item.text ?? "",
        Number.isFinite(due) ? due : null,
        item.due_time ?? null,
        item.all_day === false ? 0 : 1,
        now,
      );
    }
  });
}

export async function deleteNote(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM notes WHERE id = ?", id);
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

// --- READ ------------------------------------------------------------------

export async function getNote(id) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT * FROM notes WHERE id = ?", id);
  if (!row) return null;
  const note = hydrateNote(row);
  const items = await db.getAllAsync(
    `SELECT id, text, due_date, due_time, all_day, status, calendar_event_id
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

export async function getOpenActionItems(limit = 50) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM action_items
     WHERE status = 'open'
     ORDER BY (due_date IS NULL), due_date ASC
     LIMIT ?`,
    limit,
  );
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
       a.calendar_event_id, a.created_at, a.note_id,
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
    createdAt: r.created_at,
    noteSummary: r.note_summary ?? "",
    notePeople: JSON.parse(r.people_json || "[]"),
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
  const columnMap = {
    person: "people_json",
    product: "topics_json",
    company: "companies_json",
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
  const row = await db.getFirstAsync(
    `SELECT calendar_event_id FROM action_items WHERE id = ?`,
    id,
  );
  if (!row) return null;
  await db.runAsync(`DELETE FROM action_items WHERE id = ?`, id);
  return row.calendar_event_id ?? null;
}

// --- helpers ---------------------------------------------------------------

export function hydrateNote(row) {
  const products = JSON.parse(row.topics_json || "[]");
  return {
    id: row.id,
    timestamp: row.created_at,
    transcript: row.transcript,
    summary: row.summary,
    people: JSON.parse(row.people_json || "[]"),
    topics: products, // mirrors products for edit-form compat
    products,
    companies: JSON.parse(row.companies_json || "[]"),
    decisions: JSON.parse(row.decisions_json || "[]"),
    action_items: [],
    openActionCount: row.open_count ?? 0,
  };
}
