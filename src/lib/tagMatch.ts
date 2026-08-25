import { stemKey } from "../db/shared";
import { normalizePersonName } from "../normalizeName";

// Word-boundary SUBSET match: every stemmed word of `query` must appear in
// one topic's own stemmed word set. This is the single definition of "does
// this tag match this query" — db/notesRead.js's getNotesByTag('topic', …)
// calls this for its in-JS filter (after fetching candidate rows), and the
// notes-list screen's client-side chip filter calls it directly against an
// already-fetched Note's `topics` array. Keeping one definition means the
// agent's tag-lookup tool and the notes-list chip can never drift apart.
// See db/notesRead.js for why this is a subset match rather than a raw
// substring or exact-equality check (a topic tag is a short atomic label,
// not free text).
export function topicTagMatches(query: string, topics: string[]): boolean {
  const needleWords = stemKey(query);
  return topics.some((topic) => {
    const topicWords = new Set(stemKey(topic));
    return needleWords.every((w) => topicWords.has(w));
  });
}

// Exact normalized-key equality — the same rule db/notesRead.js's person
// branch enforces via SQL (`people_normalized_json LIKE '%"key":"<key>"%'`),
// but usable directly against a Note's `people` array (display strings
// only — hydrateNote never surfaces people_normalized_json to the app layer,
// see db/shared.js). Recomputing the key from a display name at compare time
// is safe because normalizePersonName is idempotent on an
// already-honorific-stripped display string: re-deriving
// key = toKey(stripHonorific(display)) reproduces exactly the key that was
// computed from that same display value at write time (normalizeAndDedupeNames,
// db/shared.js). This intentionally does NOT reimplement the SQL LIKE
// (substring) behavior — it's a stricter exact-key check, which is what
// "the same person" should mean for a client-side filter.
export function personKeyMatches(key: string, displayName: string): boolean {
  return normalizePersonName(displayName).key === key;
}
