// Generic Greek stemming primitive — reusable by anything doing Greek word
// matching (FTS5 prefix queries in db/fts.js, tag-key equality in db/shared.js
// / db/notesRead.js). Operates on already-toKey()'d text (lib/textNormalize.ts)
// — callers are responsible for normalizing first.

// Common Greek noun/adjective/verb endings, in match-priority order. Written
// with regular sigma (σ), not final sigma (ς) — every word reaching this list
// has already been through toKey(), which folds ς→σ, so a final-sigma ending
// would never match.
// "εισ" must precede "ισ": every word ending in "εισ" also ends in "ισ" (its
// own last two letters), so checking "ισ" first would strip the wrong,
// shorter suffix. No other pair in this list overlaps as a suffix of another.
const GREEK_ENDINGS = [
  "ουσ", "ων", "εσ", "εισ", "οσ", "ου", "ον", "ασ", "ησ", "ισ", "α", "η", "ο", "ε",
];

const MIN_TERM_LENGTH = 5; // below this, a stripped ending leaves too little signal to be worth the false-positive risk
const MIN_STEM_LENGTH = 4; // hard floor — shorter prefixes false-positive-match unrelated words, e.g.
                            // "κάνεις" → naive stem "καν" would prefix-match "κανάτα", "κανόνι", "καναπές";
                            // "γάμους" → naive stem "γαμ" would prefix-match "γάμα", "γαμήλιος" — both cases
                            // semantically unrelated to the searched word.

// Strips the first (highest-priority, per GREEK_ENDINGS order) matching
// ending from an already-toKey()'d word, if the word is long enough to risk
// it and the remaining stem clears the false-positive floor. Returns null
// when stemming isn't safe — caller falls back to an exact token.
export function stemGreekTerm(word: string): string | null {
  if (word.length < MIN_TERM_LENGTH) return null;
  for (const ending of GREEK_ENDINGS) {
    if (word.endsWith(ending)) {
      const stem = word.slice(0, word.length - ending.length);
      return stem.length >= MIN_STEM_LENGTH ? stem : null;
    }
  }
  return null;
}
