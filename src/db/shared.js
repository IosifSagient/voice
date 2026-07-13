import { normalizePersonName } from "../normalizeName";

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

export { safeParseArray };
