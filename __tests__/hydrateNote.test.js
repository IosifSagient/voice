const { hydrateNote } = require('../src/db');

function makeRow(overrides = {}) {
  return {
    id: 'abc-123',
    created_at: 1700000000000,
    transcript: 'hello',
    summary: 'test summary',
    people_json: '["Alice","Bob"]',
    topics_json: '["TopicX"]',
    decisions_json: '[]',
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

  it('parses topics_json into an array', () => {
    const note = hydrateNote(makeRow());
    expect(note.topics).toEqual(['TopicX']);
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
      decisions_json: null,
    }));
    expect(note.people).toEqual([]);
    expect(note.topics).toEqual([]);
    expect(note.decisions).toEqual([]);
  });

  it('degrades a malformed JSON column to [] instead of throwing, and logs the failing note/field', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const note = hydrateNote(makeRow({ id: 'bad-note', people_json: '{not valid json' }));

    expect(note.people).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bad-note'),
      expect.anything(),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('people_json'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it('a malformed column does not affect the other (valid) columns on the same row', () => {
    const note = hydrateNote(makeRow({ people_json: '{not valid json', topics_json: '["fine"]' }));
    expect(note.people).toEqual([]);
    expect(note.topics).toEqual(['fine']);
  });
});
