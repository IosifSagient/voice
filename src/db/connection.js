import * as SQLite from "expo-sqlite";
import { normalizeAndDedupeNames } from "./shared";

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
export async function migrate(db) {
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

  // External-content FTS5 index over transcript/summary. Unlike the ALTER TABLE
  // list above, failures here are logged rather than silently swallowed — a
  // hypothetical FTS5-disabled build should still start (search just won't
  // find notes_fts later), but that should be visible in logs, not silent.
  try {
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        transcript, summary,
        content=notes, content_rowid=rowid,
        tokenize='unicode61 remove_diacritics 2'
      );
    `);
  } catch (err) {
    console.error("[db:migrate] failed to create notes_fts (FTS5 may be unavailable)", err);
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

  // One-time backfill of the FTS5 index for notes that existed before notes_fts
  // did — saveNote/updateNote/deleteNote keep it in sync for everything after,
  // this only catches up pre-existing rows.
  if (user_version < 3) {
    const rows = await db.getAllAsync("SELECT rowid, transcript, summary FROM notes");
    for (const row of rows) {
      try {
        await db.runAsync(
          "INSERT INTO notes_fts (rowid, transcript, summary) VALUES (?, ?, ?)",
          row.rowid,
          row.transcript ?? "",
          row.summary ?? "",
        );
      } catch (err) {
        // A single malformed/duplicate row must not fail the whole migration —
        // skip it and keep going so every other note still gets indexed.
        console.error(`[db:migrate] failed to backfill notes_fts for rowid ${row.rowid}, skipping`, err);
      }
    }
    await db.execAsync("PRAGMA user_version = 3");
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
export function getDb() {
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
