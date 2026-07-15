jest.mock('expo-sqlite', () => {
  const { toKey } = require('../src/lib/textNormalize');

  const rows = [
    {
      id: 'match-in-range', created_at: Date.UTC(2026, 6, 8),
      transcript: 'μιλήσαμε για τους κλιβάνους στο εργαστήριο', summary: '',
      people_json: '[]', topics_json: '[]', decisions_json: '[]', open_count: 0,
    },
    {
      id: 'match-out-of-range', created_at: Date.UTC(2026, 5, 1),
      transcript: 'κλιβάνους ξανά', summary: '',
      people_json: '[]', topics_json: '[]', decisions_json: '[]', open_count: 0,
    },
    {
      id: 'no-match-in-range', created_at: Date.UTC(2026, 6, 9),
      transcript: 'πήγα για νερό', summary: '',
      people_json: '[]', topics_json: '[]', decisions_json: '[]', open_count: 0,
    },
  ];

  function extractPrefix(ftsQuery) {
    return ftsQuery.replace(/^"|"$/g, '').replace(/\*$/, '');
  }

  async function execAsync() {}
  async function getFirstAsync(sql) {
    if (sql.includes('PRAGMA user_version')) return { user_version: 5 };
    return null;
  }
  async function getAllAsync(sql, ...params) {
    if (sql.includes('people_normalized_json IS NULL')) return [];
    if (!sql.includes('FROM notes_fts')) return [];
    const [ftsQuery, fromTs, toTsExclusive] = params;
    const prefix = extractPrefix(ftsQuery);
    return rows.filter((r) => {
      const words = toKey(`${r.transcript} ${r.summary}`).split(/\s+/);
      const wordMatch = words.some((w) => w.startsWith(prefix));
      const inRange = r.created_at >= fromTs && r.created_at < toTsExclusive;
      return wordMatch && inRange;
    });
  }

  return {
    openDatabaseAsync: jest.fn(() =>
      Promise.resolve({ execAsync, getFirstAsync, getAllAsync }),
    ),
  };
});

const { searchNotesInRange } = require('../src/db');

describe('searchNotesInRange', () => {
  it('returns a note matching the term AND within the date range', async () => {
    const results = await searchNotesInRange('κλιβάνων', '2026-07-01', '2026-07-15');
    expect(results.map((r) => r.id)).toEqual(['match-in-range']);
  });

  it('excludes a term match outside the date range', async () => {
    const results = await searchNotesInRange('κλιβάνων', '2026-07-01', '2026-07-15');
    expect(results.map((r) => r.id)).not.toContain('match-out-of-range');
  });

  it('excludes an in-range note whose term does not match', async () => {
    const results = await searchNotesInRange('κλιβάνων', '2026-07-01', '2026-07-15');
    expect(results.map((r) => r.id)).not.toContain('no-match-in-range');
  });

  it('returns [] without querying when the date is invalid', async () => {
    const results = await searchNotesInRange('κλιβάνων', 'not-a-date', '2026-07-15');
    expect(results).toEqual([]);
  });
});
