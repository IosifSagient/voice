const { migrate } = require('../src/db');

// Minimal fake db: implements only the calls migrate() actually makes,
// tracking issued execAsync SQL and notes_fts inserts for assertions.
function makeFakeDb({ userVersion = 0, notes = [] } = {}) {
  const execCalls = [];
  const ftsRows = [];
  let version = userVersion;

  return {
    execCalls,
    ftsRows,
    async execAsync(sql) {
      execCalls.push(sql);
      const versionMatch = sql.match(/PRAGMA user_version = (\d+)/);
      if (versionMatch) version = Number(versionMatch[1]);
    },
    async getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: version };
      return null;
    },
    async getAllAsync(sql) {
      if (sql.includes('SELECT rowid, transcript, summary FROM notes')) {
        return notes.map((n) => ({ rowid: n.rowid, transcript: n.transcript, summary: n.summary }));
      }
      return [];
    },
    async runAsync(sql, ...params) {
      if (sql.includes('INSERT INTO notes_fts')) {
        const [rowid, transcript, summary] = params;
        ftsRows.push({ rowid, transcript, summary });
      }
      return { changes: 1 };
    },
  };
}

describe('FTS5 migration', () => {
  it('issues the CREATE VIRTUAL TABLE statement for notes_fts on every migrate() call', async () => {
    const db = makeFakeDb({ userVersion: 3 });

    await migrate(db);

    expect(
      db.execCalls.some(
        (sql) => sql.includes('CREATE VIRTUAL TABLE') && sql.includes('notes_fts') && sql.includes('fts5'),
      ),
    ).toBe(true);
  });

  it('backfills notes_fts from all existing notes when user_version < 3', async () => {
    const db = makeFakeDb({
      userVersion: 0,
      notes: [
        { rowid: 1, transcript: 'Ο Παπαδόπουλος ήρθε', summary: 'S1' },
        { rowid: 2, transcript: 'Άλλη σημείωση', summary: 'S2' },
      ],
    });

    await migrate(db);

    expect(db.ftsRows).toEqual([
      { rowid: 1, transcript: 'Ο Παπαδόπουλος ήρθε', summary: 'S1' },
      { rowid: 2, transcript: 'Άλλη σημείωση', summary: 'S2' },
    ]);
    expect(db.execCalls).toContain('PRAGMA user_version = 3');
  });

  it('skips the notes_fts backfill when user_version is already 3', async () => {
    const db = makeFakeDb({
      userVersion: 3,
      notes: [{ rowid: 1, transcript: 'should not be backfilled', summary: 'S1' }],
    });

    await migrate(db);

    expect(db.ftsRows).toEqual([]);
    expect(db.execCalls).not.toContain('PRAGMA user_version = 3');
  });
});
