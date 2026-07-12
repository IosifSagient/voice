const { backfill } = require('../src/db');

// Minimal fake db: only implements the two calls backfill() actually makes.
function makeFakeDb(initialRows) {
  const rows = new Map(initialRows.map((r) => [r.id, { ...r }]));
  return {
    rows,
    async getAllAsync() {
      return [...rows.values()]
        .filter((r) => r.people_normalized_json == null)
        .map((r) => ({ id: r.id, people_json: r.people_json }));
    },
    async runAsync(sql, peopleJson, peopleNormalizedJson, id) {
      const row = rows.get(id);
      row.people_json = peopleJson;
      row.people_normalized_json = peopleNormalizedJson;
    },
  };
}

describe('backfill', () => {
  it('rewrites people_json to clean, deduped display names and fills people_normalized_json', async () => {
    const db = makeFakeDb([
      {
        id: '1',
        people_json: JSON.stringify(['δόκτωρ Παπαδόπουλος', 'Δρ Παπαδόπουλος']),
        people_normalized_json: null,
      },
    ]);

    await backfill(db);

    const row = db.rows.get('1');
    expect(JSON.parse(row.people_json)).toEqual(['Παπαδόπουλος']);
    expect(JSON.parse(row.people_normalized_json)).toEqual([
      { key: 'παπαδοπουλοσ', display: 'Παπαδόπουλος' },
    ]);
  });

  it('a second run is a no-op once every row has been normalized', async () => {
    const db = makeFakeDb([
      {
        id: '1',
        people_json: JSON.stringify(['δόκτωρ Παπαδόπουλος']),
        people_normalized_json: null,
      },
    ]);

    await backfill(db);
    const afterFirstRun = JSON.stringify(db.rows.get('1'));

    await backfill(db); // people_normalized_json is now set, so the SELECT should match 0 rows
    expect(JSON.stringify(db.rows.get('1'))).toBe(afterFirstRun);
  });

  it('skips a row with malformed people_json instead of failing the whole backfill', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeFakeDb([
      {
        id: 'bad',
        people_json: '{not valid json',
        people_normalized_json: null,
      },
      {
        id: 'good',
        people_json: JSON.stringify(['δόκτωρ Παπαδόπουλος']),
        people_normalized_json: null,
      },
    ]);

    await expect(backfill(db)).resolves.toBeUndefined();

    // The malformed row is left untouched (still un-backfilled) rather than
    // crashing the loop.
    expect(db.rows.get('bad').people_normalized_json).toBeNull();
    // The other row still gets processed normally.
    expect(JSON.parse(db.rows.get('good').people_json)).toEqual(['Παπαδόπουλος']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bad'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });
});
