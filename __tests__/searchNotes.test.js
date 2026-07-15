// Regression coverage for searchNotes' FTS5 MATCH implementation (src/db.js).
// searchNotes used to do a 4-column LIKE scan (transcript/summary/people_json/
// topics_json); it now normalizes the query via lib/textNormalize's toKey and
// issues a quoted, per-term FTS5 MATCH against notes_fts (transcript + summary
// only — people/topic tag matching lives in getNotesByTag, not search).
//
// The mock pattern-matches SQL strings rather than running real SQLite, so
// these tests verify the SQL/params searchNotes EMITS, not FTS5's actual
// token-matching behavior — that's reserved for on-device verification.
//
// ON-DEVICE VERIFICATION (after the notes_fts normalization migration in
// connection.js runs — user_version 4): confirm content and query now use
// the same folded token by running, against a note whose transcript contains
// "κλιβάνους":
//   SELECT rowid, transcript FROM notes_fts WHERE notes_fts MATCH '"κλιβανουσ"'; -- folded query token (buildFtsQuery) — should now match
//   SELECT rowid, transcript FROM notes_fts WHERE notes_fts MATCH '"κλιβανους"'; -- unfolded (final-sigma) token — should NOT match post-migration,
//                                                                                --   since notes_fts no longer stores unfolded content
// See ftsMigration.test.js / ftsSync.test.js for the mocked-level equivalent
// of this check (they can't exercise real FTS5 tokenization).

const { toKey } = require('../src/lib/textNormalize');

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// dbPromise is module-scoped state inside src/db.js, so each test needs its
// own isolated module registry (mirrors dbInitRetry.test.js / ftsSync.test.js).
function freshDbModule() {
  let SQLite, db;
  jest.isolateModules(() => {
    SQLite = require('expo-sqlite');
    db = require('../src/db');
  });
  return { SQLite, db };
}

function makeFakeDb({ throwOnMatch = false, matchRows = [] } = {}) {
  const matchCalls = [];
  return {
    matchCalls,
    async execAsync() {
      /* schema / PRAGMA / CREATE VIRTUAL TABLE / ALTER TABLE — no-op for this mock */
    },
    async getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: 3 }; // already migrated
      return null;
    },
    async getAllAsync(sql, ...params) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) return [];
      if (sql.includes('FROM notes_fts') && sql.includes('MATCH')) {
        const [ftsQuery, limit] = params;
        matchCalls.push({ ftsQuery, limit });
        if (throwOnMatch) throw new Error('simulated FTS5 failure');
        return matchRows;
      }
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

describe('searchNotes — FTS5 MATCH', () => {
  it('normalizes an accented query into an unaccented, stemmed prefix token', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('Παπαδόπουλος');

    // Long enough (12 chars) and ends in "οσ" — now stems to a prefix token
    // so a genitive ("Παπαδοπούλου") also matches. See the "Greek
    // stem-prefix matching" describe block below for the stemming-specific
    // coverage; this test now only pins the toKey() normalization step.
    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'παπαδοπουλ*', limit: 10 }]);
  });

  it('quote-wraps every term so a hyphen or OR cannot act as raw FTS5 syntax', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('plumber-guy OR urgent');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"plumber-guy" "or" "urgent"', limit: 10 }]);
  });

  it('strips embedded double quotes from a term before wrapping it', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('say "urgent" now');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"say" "urgent" "now"', limit: 10 }]);
  });

  it('applies the caller-supplied limit', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('plumber', 3);

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"plumber"', limit: 3 }]);
  });

  it('returns hydrated notes built from the matched rows', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb({
      matchRows: [
        {
          id: 'n1',
          created_at: 123,
          transcript: 'call the plumber',
          summary: 'plumber follow-up',
          people_json: '[]',
          topics_json: '[]',
          decisions_json: '[]',
          open_count: 1,
        },
      ],
    });
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    const results = await db.searchNotes('plumber');

    expect(results).toEqual([
      expect.objectContaining({ id: 'n1', summary: 'plumber follow-up', openActionCount: 1 }),
    ]);
  });

  it('returns [] without issuing any SQL for a whitespace-only query', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    const results = await db.searchNotes('   ');

    expect(results).toEqual([]);
    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it('returns [] without issuing any SQL when nothing usable survives normalization (only quote marks)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    const results = await db.searchNotes('"""');

    expect(results).toEqual([]);
    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it('degrades gracefully to [] when the MATCH query throws (e.g. FTS5 unavailable)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb({ throwOnMatch: true });
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const results = await db.searchNotes('plumber');

    expect(results).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('searchNotes'),
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('searchNotes — Greek stem-prefix matching', () => {
  it('stems "κλιβάνων" to an unquoted prefix that is a true prefix of the indexed form of "κλιβάνους" (the blocker case)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('κλιβάνων');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'κλιβαν*', limit: 10 }]);
    // notes_fts stores toKey()'d content (see connection.js) — confirm the
    // stem is actually a prefix of what "κλιβάνους" normalizes to.
    expect(toKey('κλιβάνους').startsWith('κλιβαν')).toBe(true);
  });

  it('"κλιβάνους" stems to the same prefix, so it still matches itself', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('κλιβάνους');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'κλιβαν*', limit: 10 }]);
  });

  it('does not stem a short word below the floor — exact match only', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('νερό');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"νερο"', limit: 10 }]);
  });

  it('stems each word of a multi-word phrase independently, still AND\'d', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('κλιβάνων φούρνου');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'κλιβαν* φουρν*', limit: 10 }]);
  });

  it('array input ORs multiple search phrases together', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes(['κλιβάνων', 'φούρνου']);

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '(κλιβαν*) OR (φουρν*)', limit: 10 }]);
  });

  it('never wraps a prefix token in quotes (the * would become literal)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('κλιβάνων');

    const { ftsQuery } = fakeDb.matchCalls[0];
    expect(ftsQuery).toBe('κλιβαν*');
    expect(ftsQuery.startsWith('"')).toBe(false);
  });

  it('does not turn a hyphenated Greek-ish term into an unquoted prefix (injection guard)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    // Long enough to otherwise qualify for stemming, but contains a hyphen —
    // must stay on the quoted-exact path like any other non-letters-only term.
    await db.searchNotes('καλα-ουσ');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"καλα-ουσ"', limit: 10 }]);
  });
});

describe('searchNotes — Greek stopword filtering', () => {
  it('drops the article "τους" so it no longer AND-poisons the query (the repro case)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('τους κλιβάνους');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'κλιβαν*', limit: 10 }]);
  });

  it('drops the article "των" — converges to the identical query as the "τους" case', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('των κλιβάνων');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'κλιβαν*', limit: 10 }]);
  });

  it('drops the article "το", leaving the short content word as an exact token', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('το νερό');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"νερο"', limit: 10 }]);
  });

  it('falls back to the unfiltered word when the query is a single stopword', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('το');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"το"', limit: 10 }]);
  });

  it('falls back to the unfiltered words when the query is entirely stopwords', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('τι είναι');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"τι" "ειναι"', limit: 10 }]);
  });

  it('drops multiple stopwords from a mixed phrase, stemming/exact-matching the remaining content words', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('σημειώσεις για τους κλιβάνους');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: 'σημειωσ* κλιβαν*', limit: 10 }]);
  });
});
