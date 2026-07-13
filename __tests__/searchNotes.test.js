// Regression coverage for searchNotes' FTS5 MATCH implementation (src/db.js).
// searchNotes used to do a 4-column LIKE scan (transcript/summary/people_json/
// topics_json); it now normalizes the query via lib/textNormalize's toKey and
// issues a quoted, per-term FTS5 MATCH against notes_fts (transcript + summary
// only — people/topic tag matching lives in getNotesByTag, not search).
//
// The mock pattern-matches SQL strings rather than running real SQLite, so
// these tests verify the SQL/params searchNotes EMITS, not FTS5's actual
// token-matching behavior — that's reserved for on-device verification.

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
  it('normalizes an accented query into an unaccented, quoted MATCH string', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.searchNotes('Παπαδόπουλος');

    expect(fakeDb.matchCalls).toEqual([{ ftsQuery: '"παπαδοπουλοσ"', limit: 10 }]);
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
