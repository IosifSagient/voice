const { migrate } = require('../src/db');
const { toKey } = require('../src/lib/textNormalize');

// Minimal fake db: implements only the calls migrate() actually makes,
// tracking issued execAsync SQL and notes_fts inserts for assertions.
// DROP TABLE clears ftsRows to mirror real SQLite semantics — the
// user_version<4 migration relies on the drop actually wiping prior (raw)
// entries before the normalized reinsert.
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
      if (sql.includes('DROP TABLE') && sql.includes('notes_fts')) {
        ftsRows.length = 0;
      }
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

  it('backfills notes_fts from all existing notes when user_version < 3, then the < 4 step normalizes it', async () => {
    const db = makeFakeDb({
      userVersion: 0,
      notes: [
        { rowid: 1, transcript: 'Ο Παπαδόπουλος ήρθε', summary: 'S1' },
        { rowid: 2, transcript: 'Άλλη σημείωση', summary: 'S2' },
      ],
    });

    await migrate(db);

    // A fresh (version 0) DB passes through every step in one run: the <3
    // step inserts raw text, then the <4 step drops the table (wiping those
    // raw rows in real SQLite, modeled here too — see makeFakeDb) and
    // reinserts toKey()-normalized text. Only the normalized end state
    // should remain.
    expect(db.ftsRows).toEqual([
      { rowid: 1, transcript: toKey('Ο Παπαδόπουλος ήρθε'), summary: toKey('S1') },
      { rowid: 2, transcript: toKey('Άλλη σημείωση'), summary: toKey('S2') },
    ]);
    expect(db.execCalls).toContain('PRAGMA user_version = 3');
    expect(db.execCalls).toContain('PRAGMA user_version = 4');
  });

  it('skips both backfill steps when user_version is already 4', async () => {
    const db = makeFakeDb({
      userVersion: 4,
      notes: [{ rowid: 1, transcript: 'should not be touched', summary: 'S1' }],
    });

    await migrate(db);

    expect(db.ftsRows).toEqual([]);
    expect(db.execCalls).not.toContain('PRAGMA user_version = 3');
    expect(db.execCalls).not.toContain('PRAGMA user_version = 4');
  });

  it('rebuilds notes_fts with normalized (toKey) content when user_version < 4', async () => {
    const db = makeFakeDb({
      userVersion: 3,
      notes: [{ rowid: 1, transcript: 'κλιβάνους', summary: 'Καθαρισμός κλιβάνου' }],
    });

    await migrate(db);

    expect(db.execCalls).not.toContain('PRAGMA user_version = 3'); // already past this step
    expect(db.execCalls).toContain('PRAGMA user_version = 4');
    expect(db.execCalls.some((sql) => sql.includes('DROP TABLE') && sql.includes('notes_fts'))).toBe(true);
    expect(db.ftsRows).toEqual([
      { rowid: 1, transcript: 'κλιβανουσ', summary: toKey('Καθαρισμός κλιβάνου') },
    ]);
  });
});
