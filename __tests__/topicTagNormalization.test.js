// Regression coverage for the topic branch of getNotesByTag (src/db/notesRead.js).
// It used to do a raw SQL LIKE against the unnormalized topics_json column, so an
// accent or case difference between the query value and the stored tag silently
// returned zero rows even though the "same" topic existed. It then moved to a
// substring match over toKey()'d text (accent/case/final-sigma insensitive, but
// NOT inflection-bridging, and prone to false positives like "λήση" matching
// inside "πώληση").
//
// It now compares by word-boundary SUBSET match on stemKey (db/shared.js, built
// on the same Greek stemmer search uses — lib/greekStem.ts): every stemmed word
// of the query must appear in the tag's stemmed word set. stemKey operates
// word-wise (not on the whole tag string) specifically so a single-word query
// can still find a multi-word tag by any of its content words — e.g. "φόρος"
// finds "φόρος εισοδήματος", and "κλίβανος" finds "πώληση κλιβάνων" — while a
// naive substring like "λήση" no longer spuriously matches "πώληση".

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
      if (sql.includes('PRAGMA user_version')) return { user_version: 5 };
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

describe('getNotesByTag("topic", …) — word-boundary stemKey matching', () => {
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

  it('(c) word-boundary match replaces substring — "λήση" does NOT match inside "πώληση"', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['πώληση κλιβάνων'])]));

    const results = await db.getNotesByTag('topic', 'λήση');

    expect(results).toEqual([]);
  });

  it('(d) bridges Greek inflection both directions — the bug this fix exists for', async () => {
    // getDb() memoizes its connection per module instance, so each direction
    // needs its own fresh module — reusing one and swapping mockResolvedValue
    // mid-test would just keep hitting the first (already-cached) fake db.
    const first = freshDbModule();
    first.SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['κλίβανος'])]));
    expect((await first.db.getNotesByTag('topic', 'κλιβάνους')).map((n) => n.id)).toEqual(['n1']);

    const second = freshDbModule();
    second.SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n2', ['κλιβάνους'])]));
    expect((await second.db.getNotesByTag('topic', 'κλίβανος')).map((n) => n.id)).toEqual(['n2']);
  });

  it('(e) finds a multi-word tag by its head content word (word-boundary subset match)', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['πώληση κλιβάνων'])]));

    const results = await db.getNotesByTag('topic', 'κλίβανος');

    expect(results.map((n) => n.id)).toEqual(['n1']);
  });

  it('(f) finds a multi-word tag by its first word — "φόρος" finds "φόρος εισοδήματος"', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['φόρος εισοδήματος'])]));

    const results = await db.getNotesByTag('topic', 'φόρος');

    expect(results.map((n) => n.id)).toEqual(['n1']);
  });

  it('falls back to exact toKey equality for a short topic word that cannot be safely stemmed', async () => {
    const { SQLite, db } = freshDbModule();
    SQLite.openDatabaseAsync.mockResolvedValue(makeFakeDb([note('n1', ['νερό'])]));

    expect((await db.getNotesByTag('topic', 'ΝΕΡΌ')).map((n) => n.id)).toEqual(['n1']);
    expect(await db.getNotesByTag('topic', 'νερά')).toEqual([]); // different word, not bridged (below the stemming floor)
  });
});
