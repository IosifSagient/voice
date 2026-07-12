// Regression coverage for getDb()'s singleton behavior in src/db.js: a
// rejected init chain (e.g. a migration throwing) used to be cached forever,
// failing every subsequent db call for the rest of the session. It must now
// clear itself on rejection so the next call retries, while callers that were
// already in flight during a failed attempt share a single openDatabaseAsync()
// call rather than each spawning their own.

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// dbPromise is module-scoped state inside src/db.js, so each test needs its
// own isolated module registry — otherwise a prior test's cached (resolved)
// db would leak in and short-circuit the next test's mock setup.
function freshDbModule() {
  let SQLite, db;
  jest.isolateModules(() => {
    SQLite = require('expo-sqlite');
    db = require('../src/db');
  });
  return { SQLite, initDb: db.initDb };
}

// A db double that satisfies schema exec, migrations (already at the latest
// user_version, so both one-time repairs are skipped), and backfill (no rows).
function makeGoodDb() {
  return {
    async execAsync() {},
    async getFirstAsync() {
      return { user_version: 2 };
    },
    async getAllAsync() {
      return [];
    },
    async runAsync() {
      return { changes: 0 };
    },
  };
}

function makeBadDb() {
  return {
    async execAsync() {
      throw new Error('schema init failed');
    },
  };
}

describe('getDb() singleton — retry after failure', () => {
  it('a failed init does not poison future calls — the next call retries and succeeds', async () => {
    const { SQLite, initDb } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValueOnce(makeBadDb());
    await expect(initDb()).rejects.toThrow('schema init failed');

    SQLite.openDatabaseAsync.mockResolvedValueOnce(makeGoodDb());
    await expect(initDb()).resolves.toBeUndefined();

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('concurrent callers during a failed init share one openDatabaseAsync call, not one each', async () => {
    const { SQLite, initDb } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValueOnce(makeBadDb());

    const results = await Promise.allSettled([initDb(), initDb(), initDb()]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);

    // After the shared failure settles, the next call is a fresh retry attempt.
    SQLite.openDatabaseAsync.mockResolvedValueOnce(makeGoodDb());
    await expect(initDb()).resolves.toBeUndefined();
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('a successful init is cached — subsequent calls do not re-open the database', async () => {
    const { SQLite, initDb } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValueOnce(makeGoodDb());

    await expect(initDb()).resolves.toBeUndefined();
    await expect(initDb()).resolves.toBeUndefined();

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
