import { normalizePersonName } from "../normalizeName";
import { toKey } from "../lib/textNormalize";
import { stemGreekTerm } from "../lib/greekStem";

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

// Word-wise Greek-inflection-tolerant key for a tag/phrase: each whitespace-
// separated word is reduced independently to (stemGreekTerm ?? its own
// toKey()'d form), returned as an ordered array of per-word keys.
//
// Operating word-wise (not on the whole string) matters for multi-word
// tags/phrases: stemming a whole phrase as a single unit only ever strips
// from its LAST word, mangling every earlier word and making head-word
// lookups impossible (e.g. a naive whole-string stem of "φόρος εισοδήματος"
// could never be reached by searching "φόρος" alone). See getNotesByTag's
// topic branch (notesRead.js) for the word-boundary subset match this
// enables, and canonicalizeTopics below for how it's joined into one
// grouping key.
export function stemKey(text) {
  return toKey(text)
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => stemGreekTerm(w) ?? w);
}

// Groups a note's raw topic tags by stemKey (joined into a single string —
// order-preserving, so "φόρος εισοδήματος" and "εισοδήματος φόρος" are
// treated as different tags, which is correct: word order carries meaning in
// a compound noun phrase), merging near-duplicate spelling/inflection
// variants (e.g. "κλίβανος" + "κλιβάνους" said in the same note) into one
// canonical entry. Display-form choice is a cheap deterministic heuristic,
// not an LLM call: the shortest raw variant wins (a reasonable proxy for the
// nominative/base form), ties broken by first-seen order for determinism
// (mirrors normalizeAndDedupeNames' first-occurrence-wins rule).
//
// This only merges duplicates WITHIN one note's own topic list — it does not
// touch cross-note matching, which getNotesByTag's stemKey-based comparison
// already handles at read time without needing the stored data rewritten.
export function canonicalizeTopics(rawTopics) {
  const canonicalByKey = new Map();
  const order = [];
  for (const raw of rawTopics) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const trimmed = raw.trim().replace(/\s+/g, " ");
    const key = stemKey(trimmed).join(" ");
    const existing = canonicalByKey.get(key);
    if (existing === undefined) {
      canonicalByKey.set(key, trimmed);
      order.push(key);
    } else if (trimmed.length < existing.length) {
      canonicalByKey.set(key, trimmed);
    }
  }
  return order.map((key) => canonicalByKey.get(key));
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
