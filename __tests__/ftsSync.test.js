// Regression coverage for FTS5 sync in the note write paths (src/db.js):
// saveNote/updateNote/deleteNote must keep notes_fts (the external-content FTS5
// index over transcript/summary) in step with the notes table, and a failure to
// do so must never fail the caller's write — same graceful-degradation stance
// as the notes_fts migration itself (see ftsMigration.test.js).

const { toKey } = require('../src/lib/textNormalize');

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// dbPromise is module-scoped state inside src/db.js, so each test needs its
// own isolated module registry (mirrors dbInitRetry.test.js).
function freshDbModule() {
  let SQLite, db;
  jest.isolateModules(() => {
    SQLite = require('expo-sqlite');
    db = require('../src/db');
  });
  return { SQLite, db };
}

// A fake db already past every migration (user_version 3, notes_fts exists),
// tracking notes_fts statements separately from the real notes table so tests
// can assert on FTS sync without caring about notes-table bookkeeping.
//
// Disambiguating "INSERT INTO notes (" (the real table) from "INSERT INTO
// notes_fts" matters: the latter contains the former as a substring, so a
// naive `sql.includes('INSERT INTO notes')` check would misfire on both.
function makeFakeDb({ throwOn = null } = {}) {
  const rows = [];
  let nextRowid = 1;
  const ftsCalls = [];

  return {
    ftsCalls,
    rows,
    async execAsync() {
      /* schema / PRAGMA / CREATE VIRTUAL TABLE / ALTER TABLE — no-op for this mock */
    },
    async getFirstAsync(sql, ...params) {
      if (sql.includes('PRAGMA user_version')) return { user_version: 3 };
      if (sql.includes('SELECT rowid, transcript, summary FROM notes WHERE id = ?')) {
        const [id] = params;
        const row = rows.find((r) => r.id === id);
        return row ? { rowid: row.rowid, transcript: row.transcript, summary: row.summary } : null;
      }
      return null;
    },
    async getAllAsync(sql) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) return [];
      return [];
    },
    async runAsync(sql, ...params) {
      if (sql.includes('INSERT INTO notes (')) {
        const [
          id, created_at, transcript, summary,
          people_json, topics_json, decisions_json, people_normalized_json,
        ] = params;
        const rowid = nextRowid++;
        rows.push({ rowid, id, created_at, transcript, summary, people_json, topics_json, decisions_json, people_normalized_json });
        return { changes: 1, lastInsertRowId: rowid };
      }
      if (sql.startsWith('UPDATE notes SET transcript')) {
        const id = params[params.length - 1];
        const row = rows.find((r) => r.id === id);
        if (row) {
          const [transcript, summary, people_json, topics_json, decisions_json, people_normalized_json] = params;
          Object.assign(row, { transcript, summary, people_json, topics_json, decisions_json, people_normalized_json });
        }
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM notes WHERE id')) {
        const [id] = params;
        const idx = rows.findIndex((r) => r.id === id);
        if (idx !== -1) rows.splice(idx, 1);
        return { changes: 1 };
      }
      if (sql.includes("INSERT INTO notes_fts (notes_fts, rowid, transcript, summary) VALUES ('delete'")) {
        if (throwOn === 'delete') throw new Error('simulated FTS failure');
        ftsCalls.push({ type: 'delete', rowid: params[0], transcript: params[1], summary: params[2] });
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO notes_fts')) {
        if (throwOn === 'insert') throw new Error('simulated FTS failure');
        ftsCalls.push({ type: 'insert', rowid: params[0], transcript: params[1], summary: params[2] });
        return { changes: 1 };
      }
      return { changes: 1 };
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
}

describe('FTS5 sync on note writes', () => {
  it('saveNote issues a notes_fts insert with the saved transcript/summary', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.saveNote(
      { summary: 'Θα πάρω τηλέφωνο', people: [], topics: [], action_items: [] },
      'transcript text',
    );

    expect(fakeDb.ftsCalls).toEqual([
      {
        type: 'insert',
        rowid: expect.any(Number),
        transcript: toKey('transcript text'),
        summary: toKey('Θα πάρω τηλέφωνο'),
      },
    ]);
  });

  it('saveNote folds final sigma (ς→σ) into the indexed transcript, matching the search-query token', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.saveNote(
      { summary: '', people: [], topics: [], action_items: [] },
      'Πήγα να δω τους κλιβάνους',
    );

    // "κλιβάνους" indexed with a folded regular sigma (κλιβανουσ), not the
    // final-sigma form (κλιβανους) — buildFtsQuery folds the query the same
    // way, so these must agree or the MATCH never fires. See searchNotes.test.js
    // for the query-side equivalent of this assertion.
    expect(fakeDb.ftsCalls[0].transcript).toBe('πηγα να δω τουσ κλιβανουσ');
  });

  it('saveNote strips Greek tonos accents from the indexed transcript', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    await db.saveNote(
      { summary: '', people: [], topics: [], action_items: [] },
      'Ο Παπαδόπουλος ήρθε',
    );

    expect(fakeDb.ftsCalls[0].transcript).toBe('ο παπαδοπουλοσ ηρθε');
  });

  it('updateNote issues the delete command with the OLD values, then the insert with the NEW values', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    const noteId = await db.saveNote(
      { summary: 'old summary', people: [], topics: [], action_items: [] },
      'old transcript',
    );
    fakeDb.ftsCalls.length = 0; // isolate to the update below

    await db.updateNote({
      id: noteId,
      transcript: 'new transcript',
      summary: 'new summary',
      people: [],
      topics: [],
      decisions: [],
      action_items: [],
    });

    expect(fakeDb.ftsCalls).toEqual([
      { type: 'delete', rowid: expect.any(Number), transcript: 'old transcript', summary: 'old summary' },
      { type: 'insert', rowid: expect.any(Number), transcript: 'new transcript', summary: 'new summary' },
    ]);
  });

  it('deleteNote issues the delete command for the removed row', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb();
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);

    const noteId = await db.saveNote(
      { summary: 'gone summary', people: [], topics: [], action_items: [] },
      'gone transcript',
    );
    fakeDb.ftsCalls.length = 0;

    await db.deleteNote(noteId);

    expect(fakeDb.ftsCalls).toEqual([
      { type: 'delete', rowid: expect.any(Number), transcript: 'gone transcript', summary: 'gone summary' },
    ]);
  });

  it('a throwing FTS insert does not reject saveNote (graceful degradation)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb({ throwOn: 'insert' });
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      db.saveNote({ summary: 's', people: [], topics: [], action_items: [] }, 't'),
    ).resolves.toEqual(expect.any(String));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('saveNote'),
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });

  it('a throwing FTS delete does not reject deleteNote (graceful degradation)', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb({ throwOn: 'delete' });
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const noteId = await db.saveNote({ summary: 's', people: [], topics: [], action_items: [] }, 't');

    await expect(db.deleteNote(noteId)).resolves.toEqual(expect.any(Array));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('deleteNote'),
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });

  it('a throwing FTS delete-command in updateNote does not block the fresh insert or reject the save', async () => {
    const { SQLite, db } = freshDbModule();
    const fakeDb = makeFakeDb({ throwOn: 'delete' });
    SQLite.openDatabaseAsync.mockResolvedValue(fakeDb);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const noteId = await db.saveNote({ summary: 'old', people: [], topics: [], action_items: [] }, 'old t');
    fakeDb.ftsCalls.length = 0;

    await expect(
      db.updateNote({
        id: noteId,
        transcript: 'new t',
        summary: 'new',
        people: [],
        topics: [],
        decisions: [],
        action_items: [],
      }),
    ).resolves.toEqual(expect.objectContaining({ removed: [], changed: [] }));

    // The delete command failed, but the fresh insert still went through —
    // each FTS statement is its own try/catch, not one shared block.
    expect(fakeDb.ftsCalls).toEqual([
      { type: 'insert', rowid: expect.any(Number), transcript: 'new t', summary: 'new' },
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('updateNote'),
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });
});
