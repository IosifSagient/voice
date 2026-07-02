const { hydrateNote } = require('../src/db');

function makeRow(overrides = {}) {
  return {
    id: 'abc-123',
    created_at: 1700000000000,
    transcript: 'hello',
    summary: 'test summary',
    people_json: '["Alice","Bob"]',
    topics_json: '["ProductX"]',
    decisions_json: '[]',
    companies_json: '["Acme"]',
    open_count: 3,
    ...overrides,
  };
}

describe('hydrateNote', () => {
  it('maps id, timestamp, transcript, summary', () => {
    const note = hydrateNote(makeRow());
    expect(note.id).toBe('abc-123');
    expect(note.timestamp).toBe(1700000000000);
    expect(note.transcript).toBe('hello');
    expect(note.summary).toBe('test summary');
  });

  it('parses people_json into an array', () => {
    const note = hydrateNote(makeRow());
    expect(note.people).toEqual(['Alice', 'Bob']);
  });

  it('parses topics_json into both products and topics', () => {
    const note = hydrateNote(makeRow());
    expect(note.products).toEqual(['ProductX']);
    expect(note.topics).toEqual(['ProductX']); // mirror
  });

  it('parses companies_json', () => {
    const note = hydrateNote(makeRow());
    expect(note.companies).toEqual(['Acme']);
  });

  it('maps open_count to openActionCount', () => {
    const note = hydrateNote(makeRow({ open_count: 7 }));
    expect(note.openActionCount).toBe(7);
  });

  it('defaults openActionCount to 0 when open_count is absent', () => {
    const row = makeRow();
    delete row.open_count;
    const note = hydrateNote(row);
    expect(note.openActionCount).toBe(0);
  });

  it('initialises action_items as an empty array', () => {
    const note = hydrateNote(makeRow());
    expect(note.action_items).toEqual([]);
  });

  it('handles null/missing JSON columns gracefully', () => {
    const note = hydrateNote(makeRow({
      people_json: null,
      topics_json: null,
      companies_json: null,
      decisions_json: null,
    }));
    expect(note.people).toEqual([]);
    expect(note.products).toEqual([]);
    expect(note.companies).toEqual([]);
    expect(note.decisions).toEqual([]);
  });
});
