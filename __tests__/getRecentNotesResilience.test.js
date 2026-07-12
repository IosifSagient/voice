// A malformed people_json on one note (the kind of row backfill() would skip
// rather than repair — see __tests__/backfill.test.js) must not crash reads
// of every other note. getRecentNotes() should degrade just that row's
// people to [] instead of the whole call rejecting.

jest.mock('expo-sqlite', () => {
  function makeSqliteMock(rows) {
    async function execAsync() {}
    async function getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: 2 }; // already migrated
      return null;
    }
    async function getAllAsync(sql) {
      if (sql.includes('people_normalized_json IS NULL')) return []; // nothing to backfill
      if (sql.includes('FROM notes') && sql.includes('ORDER BY notes.created_at DESC')) return rows;
      return [];
    }
    return { execAsync, getFirstAsync, getAllAsync };
  }

  const rows = [
    {
      id: 'good-1',
      created_at: 2,
      transcript: 't2',
      summary: 's2',
      people_json: JSON.stringify(['Alice']),
      topics_json: '[]',
      decisions_json: '[]',
      open_count: 0,
    },
    {
      id: 'bad-1',
      created_at: 1,
      transcript: 't1',
      summary: 's1',
      people_json: '{not valid json',
      topics_json: '[]',
      decisions_json: '[]',
      open_count: 0,
    },
  ];

  return {
    openDatabaseAsync: jest.fn(() => Promise.resolve(makeSqliteMock(rows))),
  };
});

const { getRecentNotes } = require('../src/db');

describe('getRecentNotes — resilience to a malformed row', () => {
  it('returns every row, degrading only the malformed one instead of rejecting the whole call', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const notes = await getRecentNotes();

    expect(notes).toHaveLength(2);
    expect(notes.find((n) => n.id === 'good-1').people).toEqual(['Alice']);
    expect(notes.find((n) => n.id === 'bad-1').people).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bad-1'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });
});
