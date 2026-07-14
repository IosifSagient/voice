// Regression coverage for the topic branch of getNotesByTag (src/db/notesRead.js).
// It used to do a raw SQL LIKE against the unnormalized topics_json column, so an
// accent or case difference between the query value and the stored tag silently
// returned zero rows even though the "same" topic existed. It now fetches
// candidates and matches in JS via toKey (accent-strip + lowercase + final-sigma
// fold) — mirroring the normalization the person branch already gets.
//
// It intentionally does NOT bridge different Greek inflections (e.g. genitive vs
// accusative) — case (d) below documents that residual limitation.

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

function freshDbModule() {
  let SQLite, db;
  jest.isolateModules(() => {
    SQLite = require('expo-sqlite');
    db = require('../src/db');
  });
  return { SQLite, db };
}

function makeFakeDb(notes) {
  return {
    async execAsync() {},
    async getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: 3 };
      return null;
    },
    async getAllAsync(sql) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) return [];
      if (sql.includes('WHERE notes.topics_json IS NOT NULL')) {
        return notes.map((n) => ({ ...n, open_count: 0 }));
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

function note(id, topics) {
  return {
    id,
    created_at: Date.now(),
    transcript: '',
    summary: `note ${id}`,
    people_json: '[]',
    topics_json: JSON.stringify(topics),
    decisions_json: '[]',
  };
}

describe('getNotesByTag("topic", …) — accent/case normalization', () => {
  it('(a) matches despite an accent-placement difference between query and stored tag', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['κλίβανους'])]));

    const results = await db.getNotesByTag('topic', 'κλιβάνους');

    expect(results.map((n) => n.id)).toEqual(['n1']);
  });

  it('(b) matches despite case difference and final-sigma form', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['ΚΛΊΒΑΝΟΣ'])]));

    const results = await db.getNotesByTag('topic', 'κλίβανος');

    expect(results.map((n) => n.id)).toEqual(['n1']);
  });

  it('(c) matches a partial/substring query against a longer stored topic phrase', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['πώληση κλιβάνων'])]));

    const results = await db.getNotesByTag('topic', 'πώληση');

    expect(results.map((n) => n.id)).toEqual(['n1']);
  });

  it('(d) does NOT bridge different Greek inflections (accusative vs genitive) — known limitation', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['πώληση κλιβάνων'])]));

    const results = await db.getNotesByTag('topic', 'κλίβανους');

    expect(results).toEqual([]);
  });
});
