import { formatNoteForShare } from '../src/lib/formatNoteForShare';
import type { Note } from '../src/types/note';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    timestamp: 1700000000000,
    summary: 'A summary',
    transcript: 'raw transcript',
    people: ['Alice'],
    topics: ['Topic A'],
    decisions: ['Go ahead'],
    action_items: [{ text: 'Do something', due_date: '2025-07-10' }],
    openActionCount: 1,
    ...overrides,
  };
}

describe('formatNoteForShare', () => {
  it('formats a full note with all sections, excluding the transcript', () => {
    const note = makeNote();
    const result = formatNoteForShare(note);
    expect(result).toBe(
      'Περίληψη:\nA summary\n\nΕνέργειες:\n- Do something (έως 10 Ιουλίου)\n\nΆτομα: Alice\n\nΘέματα: Topic A'
    );
    expect(result).not.toContain('raw transcript');
  });

  it('omits the Ενέργειες section when action_items is empty', () => {
    const note = makeNote({ action_items: [] });
    const result = formatNoteForShare(note);
    expect(result).toBe('Περίληψη:\nA summary\n\nΆτομα: Alice\n\nΘέματα: Topic A');
    expect(result).not.toContain('Ενέργειες');
  });

  it('omits Άτομα/Θέματα sections when people and topics are empty', () => {
    const note = makeNote({ people: [], topics: [] });
    const result = formatNoteForShare(note);
    expect(result).toBe('Περίληψη:\nA summary\n\nΕνέργειες:\n- Do something (έως 10 Ιουλίου)');
    expect(result).not.toContain('Άτομα');
    expect(result).not.toContain('Θέματα');
  });

  it('emits an action item with no due date unchanged, with no suffix', () => {
    const note = makeNote({ action_items: [{ text: 'Do something', due_date: null }] });
    const result = formatNoteForShare(note);
    expect(result).toContain('- Do something\n');
    expect(result).not.toContain('έως');
  });

  it('appends the due-date suffix only to items that have one, in a mixed note', () => {
    const note = makeNote({
      action_items: [
        { text: 'Dated item', due_date: '2025-09-05' },
        { text: 'Undated item', due_date: null },
      ],
    });
    const result = formatNoteForShare(note);
    expect(result).toContain('Ενέργειες:\n- Dated item (έως 5 Σεπτεμβρίου)\n- Undated item');
  });

  it('omits the Ενέργειες section when every action item has blank text', () => {
    const note = makeNote({ action_items: [{ text: '   ', due_date: null }] });
    const result = formatNoteForShare(note);
    expect(result).not.toContain('Ενέργειες');
  });

  it('returns just the summary section when everything else is empty', () => {
    const note = makeNote({ action_items: [], people: [], topics: [] });
    const result = formatNoteForShare(note);
    expect(result).toBe('Περίληψη:\nA summary');
  });

  it('returns an empty string when the note has no summary and nothing else', () => {
    const note = makeNote({ summary: '', action_items: [], people: [], topics: [] });
    const result = formatNoteForShare(note);
    expect(result).toBe('');
  });

  it('does not throw on an all-empty note', () => {
    const note = makeNote({ summary: '', action_items: [], people: [], topics: [], decisions: [] });
    expect(() => formatNoteForShare(note)).not.toThrow();
  });
});
