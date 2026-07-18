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
// Boundary-based confidence for one match at [idx, idx+len) within an
// already-toKey()'d haystack: whole_word (non-letter or edge-of-string on
// both sides) > word_prefix (needle starts a longer word) > mid_word (needle
// is buried inside a word — the same false-positive shape greekStem.ts's own
// MIN_STEM_LENGTH floor guards against, e.g. "λήση" inside "πώληση").
function classifyBoundary(haystackKey, idx, len) {
  const isLetter = (ch) => ch != null && /\p{L}/u.test(ch);
  const before = idx > 0 ? haystackKey[idx - 1] : null;
  const after = idx + len < haystackKey.length ? haystackKey[idx + len] : null;
  if (!isLetter(before) && !isLetter(after)) return "whole_word";
  if (!isLetter(before) && isLetter(after)) return "word_prefix";
  return "mid_word";
}

// Best (lowest-rank) occurrence of needleKey in haystackKey, short-circuiting
// once a whole_word hit is found since nothing can outrank it.
const CONFIDENCE_RANK = { whole_word: 0, word_prefix: 1, mid_word: 2 };

function findBestMatch(haystackKey, needleKey) {
  let best = null;
  let from = 0;
  while (true) {
    const idx = haystackKey.indexOf(needleKey, from);
    if (idx === -1) break;
    const confidence = classifyBoundary(haystackKey, idx, needleKey.length);
    if (!best || CONFIDENCE_RANK[confidence] < CONFIDENCE_RANK[best.confidence]) {
      best = { idx, confidence };
      if (confidence === "whole_word") break;
    }
    from = idx + 1;
  }
  return best;
}

const SNIPPET_WINDOW = 40;

// Fallback substring search for the "did you mean?" flow — runs only after
// search_notes (FTS5 MATCH, word-token based) returns nothing, to catch
// mid-word/typo-adjacent hits that FTS5 tokenization can never find.
//
// notes_fts is an external-content FTS5 table (content=notes — see
// connection.js): plain reads of its columns proxy straight through to the
// RAW notes.transcript/notes.summary values, not the toKey()'d text that was
// fed to INSERT INTO notes_fts (notesWrite.js). There is no queryable
// normalized column anywhere in the schema, so — mirroring getNotesByTag's
// topic branch (notesRead.js), which hit the identical problem for
// topics_json — this fetches candidate rows and matches in JS instead of SQL.
//
// Offsets are computed against needle/haystack both passed through
// .normalize('NFC') before toKey(): toKey()'s NFD-decompose-then-strip-mark
// step is index-preserving only relative to an NFC-form input (each
// precomposed accented char round-trips to exactly one codepoint). Skipping
// this would drift every offset after the first character stored in
// decomposed (base + combining mark) form.
//
// `term` accepts a single string or an array — mirrors buildFtsQuery's own
// input normalization (Array.isArray ? input : [input], capped at 4) so a
// multi-term search_notes call (OR'd terms) can be retried against literal
// matching without losing any of the OR'd terms. Each term is tested
// independently per row/field; the existing dedup-by-noteId-keep-best-
// confidence pipeline below already collapses same-note hits from different
// sources (previously only different fields, now also different terms) —
// it needed no changes to extend correctly to the multi-term case.
export async function searchNotesLiteral(term, limit = 3) {
  const rawTerms = (Array.isArray(term) ? term : [term]).slice(0, 4);
  const needleKeys = rawTerms
    .map((t) => toKey((t ?? "").trim().normalize("NFC")))
    .filter((k) => k.length > 0);
  if (needleKeys.length === 0) return { lowConfidence: true, query: term, candidates: [] };

  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT id, created_at, transcript, summary FROM notes ORDER BY created_at DESC",
  );

  const found = [];
  for (const row of rows) {
    for (const field of ["transcript", "summary"]) {
      const originalNFC = (row[field] ?? "").normalize("NFC");
      if (!originalNFC) continue;
      const haystackKey = toKey(originalNFC);
      for (const needleKey of needleKeys) {
        const match = findBestMatch(haystackKey, needleKey);
        if (!match) continue;
        found.push({
          noteId: row.id,
          date: new Date(row.created_at).toISOString().slice(0, 10),
          summary: row.summary ?? "",
          field,
          originalNFC,
          idx: match.idx,
          matchLength: needleKey.length,
          confidence: match.confidence,
        });
      }
    }
  }

  // A note whose transcript AND summary both match — or that matches more
  // than one of several OR'd terms — produces multiple `found` entries with
  // the same noteId. Collapse to the single best-confidence one before
  // ranking, or a note could surface as two identical-noteId candidates
  // (React key collision in ClarificationChips). Map preserves insertion
  // order, so a tie (equal confidence) keeps the first-seen entry —
  // transcript before summary, and earlier terms before later ones, since
  // that's the loop order above — without needing an explicit secondary
  // comparison.
  const bestByNoteId = new Map();
  for (const entry of found) {
    const existing = bestByNoteId.get(entry.noteId);
    if (!existing || CONFIDENCE_RANK[entry.confidence] < CONFIDENCE_RANK[existing.confidence]) {
      bestByNoteId.set(entry.noteId, entry);
    }
  }
  const deduped = [...bestByNoteId.values()];

  // Array.prototype.sort is spec-stable (ES2019+): ties keep the created_at
  // DESC scan order, so recency acts as the tiebreaker without a secondary key.
  deduped.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);

  const candidates = deduped.slice(0, limit).map((f) => {
    const start = Math.max(0, f.idx - SNIPPET_WINDOW);
    const end = Math.min(f.originalNFC.length, f.idx + f.matchLength + SNIPPET_WINDOW);
    return {
      noteId: f.noteId,
      date: f.date,
      summary: f.summary,
      field: f.field,
      snippet: f.originalNFC.slice(start, end),
      matchOffset: f.idx - start,
      matchLength: f.matchLength,
      confidence: f.confidence,
    };
  });

  return { lowConfidence: true, query: term, candidates };
}

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
