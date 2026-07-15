const { migrate } = require('../src/db');

// Minimal fake db: implements only the calls the user_version < 5 topics
// repair actually makes.
function makeFakeDb({ userVersion = 0, notes = [] } = {}) {
  const execCalls = [];
  const updates = []; // { id, topics_json }
  let version = userVersion;

  return {
    execCalls,
    updates,
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
      if (sql.includes('SELECT id, topics_json FROM notes WHERE topics_json IS NOT NULL')) {
        return notes.map((n) => ({ id: n.id, topics_json: n.topics_json }));
      }
      return [];
    },
    async runAsync(sql, ...params) {
      if (sql.includes('UPDATE notes SET topics_json = ? WHERE id = ?')) {
        const [topics_json, id] = params;
        updates.push({ id, topics_json });
      }
      return { changes: 1 };
    },
  };
}

describe('topics canonicalization migration (user_version < 5)', () => {
  it('merges same-note stem duplicates and rewrites topics_json to the canonical form', async () => {
    const db = makeFakeDb({
      userVersion: 4,
      notes: [{ id: 'n1', topics_json: JSON.stringify(['κλίβανος', 'κλιβάνους']) }],
    });

    await migrate(db);

    expect(db.updates).toEqual([{ id: 'n1', topics_json: JSON.stringify(['κλίβανος']) }]);
    expect(db.execCalls).toContain('PRAGMA user_version = 5');
  });

  it('leaves a note with already-distinct topics untouched (still rewritten, same content)', async () => {
    const db = makeFakeDb({
      userVersion: 4,
      notes: [{ id: 'n1', topics_json: JSON.stringify(['διαβατήριο', 'φόρος εισοδήματος']) }],
    });

    await migrate(db);

    expect(db.updates).toEqual([
      { id: 'n1', topics_json: JSON.stringify(['διαβατήριο', 'φόρος εισοδήματος']) },
    ]);
  });

  it('skips entirely once user_version is already 5', async () => {
    const db = makeFakeDb({
      userVersion: 5,
      notes: [{ id: 'n1', topics_json: JSON.stringify(['κλίβανος', 'κλιβάνους']) }],
    });

    await migrate(db);

    expect(db.updates).toEqual([]);
    expect(db.execCalls).not.toContain('PRAGMA user_version = 5');
  });

  it('a second run at version 5 is a no-op (idempotent)', async () => {
    const db = makeFakeDb({
      userVersion: 4,
      notes: [{ id: 'n1', topics_json: JSON.stringify(['κλίβανος', 'κλιβάνους']) }],
    });

    await migrate(db);
    const firstRunUpdates = [...db.updates];
    db.updates.length = 0;

    await migrate(db); // version is now 5

    expect(db.updates).toEqual([]);
    expect(firstRunUpdates).toEqual([{ id: 'n1', topics_json: JSON.stringify(['κλίβανος']) }]);
  });

  it('skips a note with malformed topics_json instead of failing the whole migration', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeFakeDb({
      userVersion: 4,
      notes: [
        { id: 'bad', topics_json: '{not valid json' },
        { id: 'good', topics_json: JSON.stringify(['κλίβανος', 'κλιβάνους']) },
      ],
    });

    await migrate(db);

    expect(db.updates).toEqual([{ id: 'good', topics_json: JSON.stringify(['κλίβανος']) }]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bad'),
      expect.anything(),
    );
    expect(db.execCalls).toContain('PRAGMA user_version = 5');

    consoleErrorSpy.mockRestore();
  });
});
