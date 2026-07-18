// Regression coverage for searchNotesLiteral (src/db/fts.js) — the "did you
// mean?" substring fallback that only runs after search_notes (FTS5 MATCH)
// finds nothing. Covers (d) confidence ordering/offset correctness and (e)
// accent/case/final-sigma + NFD-encoded-original offset correctness from the
// design doc.
//
// notes_fts is an external-content FTS5 table (content=notes — connection.js)
// so this function scans the plain `notes` table in JS rather than issuing a
// MATCH/LIKE query — the mock below only needs to answer the plain SELECT.

const { toKey } = require('../src/lib/textNormalize');

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// dbPromise is module-scoped state inside src/db, so each test needs its own
// isolated module registry (mirrors searchNotes.test.js / ftsSync.test.js).
function freshDbModule() {
  let SQLite, db;
  jest.isolateModules(() => {
    SQLite = require('expo-sqlite');
    db = require('../src/db');
  });
  return { SQLite, db };
}

function makeFakeDb(notesRows) {
  return {
    async execAsync() {},
    async getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: 5 };
      return null;
    },
    async getAllAsync(sql) {
      if (sql.includes('people_normalized_json IS NULL')) return [];
      if (sql.includes('SELECT id, created_at, transcript, summary FROM notes')) return notesRows;
      return [];
    },
    async runAsync() {
      return { changes: 1 };
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
}

describe('searchNotesLiteral — confidence ranking and offsets', () => {
  it('ranks whole_word > word_prefix > mid_word for the same term across different notes', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        // "λιβ" mid-word inside "κλίβανο" (κ|λιβ|ανο) — letter before the match
        { id: 'mid', created_at: 3, transcript: 'καθάρισα τον κλίβανο', summary: '' },
        // "λιβ" is a prefix of "λιβάδι" — non-letter before, letter after
        { id: 'prefix', created_at: 2, transcript: 'πήγα στο λιβάδι', summary: '' },
        // "λιβ" stands alone — non-letter (or edge) on both sides
        { id: 'whole', created_at: 1, transcript: 'μίλησα για λιβ σήμερα', summary: '' },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.lowConfidence).toBe(true);
    expect(result.candidates.map((c) => c.noteId)).toEqual(['whole', 'prefix', 'mid']);
    expect(result.candidates.map((c) => c.confidence)).toEqual(['whole_word', 'word_prefix', 'mid_word']);
  });

  it('produces a matchOffset/matchLength that slices exactly the matched term out of the snippet', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'μίλησα για λιβ σήμερα', summary: '' }]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    const matched = c.snippet.slice(c.matchOffset, c.matchOffset + c.matchLength);
    expect(toKey(matched)).toBe(toKey('λιβ'));
  });

  it('breaks ties within the same confidence tier by recency (created_at DESC scan order)', async () => {
    const { SQLite, db } = freshDbModule();
    // The real SQL query is `ORDER BY created_at DESC` — this fake db returns
    // rows exactly as given (it doesn't implement ORDER BY), so the fixture
    // itself must already be in DESC order to faithfully simulate that.
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        { id: 'newer', created_at: 2, transcript: 'μίλησα ξανά για λιβ σήμερα', summary: '' },
        { id: 'older', created_at: 1, transcript: 'μίλησα για λιβ χθες', summary: '' },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates.map((c) => c.noteId)).toEqual(['newer', 'older']);
  });

  it('caps candidates at the given limit (default 3)', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        { id: 'n1', created_at: 4, transcript: 'λιβ ένα', summary: '' },
        { id: 'n2', created_at: 3, transcript: 'λιβ δύο', summary: '' },
        { id: 'n3', created_at: 2, transcript: 'λιβ τρία', summary: '' },
        { id: 'n4', created_at: 1, transcript: 'λιβ τέσσερα', summary: '' },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((c) => c.noteId)).toEqual(['n1', 'n2', 'n3']);
  });

  it('dedupes a note matching in BOTH transcript and summary into exactly one candidate, keeping the better confidence', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        {
          id: 'n1',
          created_at: 1,
          // mid-word hit in transcript: "λιβ" inside "κλίβανο"
          transcript: 'καθάρισα τον κλίβανο',
          // whole-word hit in summary: "λιβ" stands alone
          summary: 'μίλησα για λιβ σήμερα',
        },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
    expect(result.candidates[0].confidence).toBe('whole_word');
    expect(result.candidates[0].field).toBe('summary');
  });

  it('keeps the better-confidence summary match over a worse-confidence transcript match (dedup keeps best, not first-seen)', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        {
          id: 'n1',
          created_at: 1,
          // word_prefix hit in transcript — checked FIRST in the field loop,
          // so a naive "keep first-seen" implementation would wrongly win here.
          transcript: 'πήγα στο λιβάδι',
          // mid_word hit in summary is actually worse — reversed from the
          // test above so this isn't just re-proving the same direction.
          summary: 'καθάρισα τον κλίβανο',
        },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].confidence).toBe('word_prefix');
    expect(result.candidates[0].field).toBe('transcript');
  });

  it('breaks an equal-confidence transcript/summary tie in favor of transcript (first-seen)', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        {
          id: 'n1',
          created_at: 1,
          // Both fields hit "λιβ" as a mid_word match — same confidence tier.
          transcript: 'καθάρισα τον κλίβανο',
          summary: 'ο παλιός κλίβανος χάλασε',
        },
      ]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].confidence).toBe('mid_word');
    expect(result.candidates[0].field).toBe('transcript');
  });

  it('returns candidates: [] for an empty/whitespace-only term without querying', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([]));

    const result = await db.searchNotesLiteral('   ');

    expect(result).toEqual({ lowConfidence: true, query: '   ', candidates: [] });
    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it('returns candidates: [] when nothing in the corpus matches', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'πήγα για νερό', summary: '' }]),
    );

    const result = await db.searchNotesLiteral('ξενοδοχειο');

    expect(result.candidates).toEqual([]);
  });
});

describe('searchNotesLiteral — multi-term input', () => {
  it('accepts a bare string exactly as before (single-term backward compatibility)', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'μίλησα για λιβ σήμερα', summary: '' }]),
    );

    const result = await db.searchNotesLiteral('λιβ');

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
  });

  it('finds a note that matches only the SECOND of two OR\'d terms', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'πήγα στο λιβάδι', summary: '' }]),
    );

    // "καφες" never appears anywhere in the corpus; only "λιβ" (the second
    // term) matches — proves neither term is dropped/ignored.
    const result = await db.searchNotesLiteral(['καφες', 'λιβ']);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
  });

  it('dedupes a note matching BOTH OR\'d terms into exactly one candidate, keeping the better confidence', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([
        {
          id: 'n1',
          created_at: 1,
          // "λιβ" hits as word_prefix ("λιβάδι"); "καφε" hits as whole_word.
          transcript: 'πήγα στο λιβάδι για καφε',
          summary: '',
        },
      ]),
    );

    const result = await db.searchNotesLiteral(['λιβ', 'καφε']);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
    expect(result.candidates[0].confidence).toBe('whole_word');
  });

  it('caps at 4 terms — a 5th term is ignored, mirroring buildFtsQuery\'s own cap', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'μόνο αυτή η λέξη: πέμπτοσ', summary: '' }]),
    );

    // "πεμπτοσ" is the 5th term — must be dropped, so this note is never found.
    const result = await db.searchNotesLiteral(['ενα', 'δυο', 'τρια', 'τεσσερα', 'πεμπτοσ']);

    expect(result.candidates).toEqual([]);
  });

  it('drops empty/whitespace-only entries from a term array and still searches the rest', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'μίλησα για λιβ σήμερα', summary: '' }]),
    );

    const result = await db.searchNotesLiteral(['   ', 'λιβ', '']);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
  });

  it('returns candidates: [] for an array of only empty/whitespace terms, without querying', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([]));

    const result = await db.searchNotesLiteral(['', '   ']);

    expect(result.candidates).toEqual([]);
    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
  });
});

describe('searchNotesLiteral — accent/case/final-sigma and NFD-offset correctness', () => {
  it('matches an unaccented, lowercase term against accented, mixed-case original text and highlights the original casing/accents', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'Μίλησα με τον Παπαδόπουλο χθες', summary: '' }]),
    );

    const result = await db.searchNotesLiteral('παπαδοπουλο');

    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    const matched = c.snippet.slice(c.matchOffset, c.matchOffset + c.matchLength);
    expect(matched).toBe('Παπαδόπουλο'); // original casing/accent preserved in the snippet
  });

  it('matches final-sigma (ς) form of the original against a mid-sigma (σ) search term', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: 'πήγα στο εργαστήριο για κλιβάνους', summary: '' }]),
    );

    const result = await db.searchNotesLiteral('κλιβανουσ');

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].noteId).toBe('n1');
  });

  it('realigns offsets correctly when the ORIGINAL stored text is NFD-encoded (base + combining accent as two codepoints)', async () => {
    const { SQLite, db } = freshDbModule();

    // Built entirely from \u escapes (never a raw typed glyph) so the
    // composed/decomposed forms are byte-exact regardless of any Unicode
    // normalization this source file or its transport may apply to literal
    // accented characters.
    //   alpha=α  combining-acute=́  nu=ν  alpha-with-tonos=ά
    const composedName = 'άννα'; // "άννα" NFC — 4 codepoints
    const nfdName = 'άννα'; // "άννα" NFD — 5 codepoints
    expect(composedName.length).toBe(4);
    expect(nfdName.length).toBe(5);
    expect(nfdName.normalize('NFC')).toBe(composedName);
    expect(nfdName).not.toBe(composedName);

    SQLite.openDatabaseAsync.mockResolvedValue(
      makeFakeDb([{ id: 'n1', created_at: 1, transcript: `μιλήσαμε με τη ${nfdName} χθες`, summary: '' }]),
    );

    const result = await db.searchNotesLiteral(composedName);

    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    const matched = c.snippet.slice(c.matchOffset, c.matchOffset + c.matchLength);
    // Without the NFC-normalize-before-offset step, this would drift by the
    // one combining-mark codepoint stripped out of the decomposed original,
    // slicing a wrong/misaligned span instead of the composed name.
    expect(matched).toBe(composedName);
    expect(toKey(matched)).toBe(toKey(composedName));
  });
});
