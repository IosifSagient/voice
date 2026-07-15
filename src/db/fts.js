import { toKey } from "../lib/textNormalize";
import { stemGreekTerm } from "../lib/greekStem";
import { getDb } from "./connection";
import { hydrateNote, parseDueDate } from "./shared";

// Greek stopwords — articles, common prepositions/conjunctions/pronouns/verb-forms —
// written in toKey'd form (lowercase, accent-stripped, σ not ς) since this filter
// runs AFTER toKey(). Left unfiltered, these become mandatory quoted-exact AND
// tokens (too short to stem — below MIN_TERM_LENGTH) that silently AND the whole
// query into failure whenever the transcript phrases the same content with a
// different article, case, or no article at all.
const GREEK_STOPWORDS = new Set([
  // definite articles — all cases/genders
  "ο", "η", "το", "οι", "τα", "του", "τησ", "των", "τον", "την", "τουσ", "τισ",
  "στο", "στη", "στον", "στην", "στουσ", "στισ", "στα", "στου",
  // indefinite articles
  "ενασ", "μια", "ενα",
  // common function words
  "και", "να", "θα", "δε", "δεν", "με", "σε", "για", "απο", "προσ", "κατα",
  "μετα", "πριν", "οτι", "πωσ", "που", "τι", "ειναι", "εχω", "εχει",
  "μου", "σου", "μασ", "σασ",
]);

// A word is only eligible for an unquoted FTS5 prefix token if it's pure
// letters. A prefix token can't be wrapped in quotes (that turns the `*`
// literal — see tokenFor), so anything containing a hyphen, digit, colon,
// quote, etc. — the exact characters quoting used to neutralize — stays on
// the quoted-exact path instead, regardless of length.
const LETTERS_ONLY = /^\p{L}+$/u;

// One already-toKey()'d word → one MATCH token: an unquoted prefix token
// (stem*) when it stems safely, otherwise the pre-existing quoted exact
// token. Returns null for a word that's nothing but quote characters (so it
// contributes no token at all — same as the original behavior).
function tokenFor(word) {
  if (LETTERS_ONLY.test(word)) {
    const stem = stemGreekTerm(word);
    return stem ? `${stem}*` : `"${word}"`;
  }
  const stripped = word.replace(/"/g, "");
  return stripped.length > 0 ? `"${stripped}"` : null;
}

// One search phrase (space-separated words, AND'd) → one MATCH clause.
function buildTermClause(trimmedTerm) {
  const words = toKey(trimmedTerm).split(/\s+/).filter((w) => w.length > 0);
  // Drop stopwords so they don't become mandatory literal-match AND tokens —
  // but a query that's ONLY stopwords (e.g. "το") must still search for
  // something, so fall back to the unfiltered word list rather than
  // producing an empty clause.
  const contentWords = words.filter((w) => !GREEK_STOPWORDS.has(w));
  const effectiveWords = contentWords.length > 0 ? contentWords : words;
  const tokens = effectiveWords.map(tokenFor).filter((t) => t !== null);
  return tokens.length > 0 ? tokens.join(" ") : null;
}

// Builds the full MATCH expression for one or more search phrases. A single
// phrase is returned unparenthesized (unchanged from the pre-existing
// single-string behavior); multiple phrases are OR'd, each parenthesized so
// its AND'd words don't leak into the next. Caps at 4 phrases regardless of
// caller — the agent tool schema enforces 1-4, but the DB layer shouldn't
// blindly trust an upstream cap that could change.
function buildFtsQuery(input) {
  const rawTerms = (Array.isArray(input) ? input : [input]).slice(0, 4);
  const clauses = rawTerms
    .map((t) => buildTermClause((t ?? "").trim()))
    .filter((c) => c !== null);
  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0] : clauses.map((c) => `(${c})`).join(" OR ");
}

export async function searchNotes(query, limit = 10) {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const db = await getDb();
  try {
    const rows = await db.getAllAsync(
      `SELECT notes.*,
         (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
       FROM notes_fts
       JOIN notes ON notes.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
       ORDER BY notes_fts.rank
       LIMIT ?`,
      ftsQuery,
      limit,
    );
    return rows.map(hydrateNote);
  } catch (err) {
    // FTS5 unavailable, corrupt index, malformed MATCH expression, etc. — the
    // agent's search_notes tool must degrade to "no results", not crash the loop.
    console.error(`[db:searchNotes] FTS5 query failed for ${JSON.stringify(query)}, returning no results`, err);
    return [];
  }
}

// Intersection of searchNotes's FTS MATCH and getNotesByDateRange's created_at
// window, in one joined query — for a date-scoped question that ALSO filters
// by a topic/keyword (e.g. "πόσες συναντήσεις είχα αυτή την εβδομάδα"), so the
// DB does the keyword+date filtering instead of the model eyeballing a plain
// date-range result. Scopes on notes.created_at, same as getNotesByDateRange
// (a note has no separate event date — see notesRead.js).
export async function searchNotesInRange(query, from, to, limit = 50) {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];
  const fromTs = parseDueDate(from);
  const toTs = parseDueDate(to);
  if (fromTs == null || toTs == null) return [];

  const db = await getDb();
  try {
    const rows = await db.getAllAsync(
      `SELECT notes.*,
         (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
       FROM notes_fts
       JOIN notes ON notes.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
         AND notes.created_at >= ? AND notes.created_at < ?
       ORDER BY notes_fts.rank
       LIMIT ?`,
      ftsQuery,
      fromTs,
      toTs + 86400000,
      limit,
    );
    return rows.map(hydrateNote);
  } catch (err) {
    console.error(`[db:searchNotesInRange] FTS5 query failed for ${JSON.stringify(query)}, returning no results`, err);
    return [];
  }
}
