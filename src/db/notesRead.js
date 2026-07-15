import { normalizePersonName } from "../normalizeName";
import { getDb } from "./connection";
import { parseDueDate, hydrateNote, safeParseArray, stemKey } from "./shared";

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

  if (tagType !== "topic") return [];

  // topics_json has no normalized-key counterpart (unlike people_normalized_json),
  // so raw SQL LIKE can't accent/case/inflection-fold — fetch candidates and match
  // in JS via stemKey (same Greek stemmer search uses, see lib/greekStem.ts via
  // db/shared.js), comparing by word-boundary SUBSET match: every stemmed word of
  // the query must appear in the tag's stemmed word set. A topic tag is a short
  // atomic label, not free text, so "does this tag contain this word" is the
  // right question — not "is this word a raw substring" (that let "λήση" match
  // "πώληση", a false positive) and not "are these two tags exactly equal" (that
  // would make a single-word query like "φόρος" unable to find a multi-word tag
  // like "φόρος εισοδήματος").
  const rows = await db.getAllAsync(
    `SELECT notes.*,
       (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
     FROM notes
     WHERE notes.topics_json IS NOT NULL
     ORDER BY notes.created_at DESC`,
  );
  const needleWords = stemKey(value);
  const matches = rows.filter((row) =>
    safeParseArray(row.topics_json, row.id, "topics_json").some((topic) => {
      const topicWords = new Set(stemKey(topic));
      return needleWords.every((w) => topicWords.has(w));
    }),
  );
  return matches.slice(0, 20).map(hydrateNote);
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
