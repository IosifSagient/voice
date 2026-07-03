import { copyNote } from '../src/types/note';
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

describe('copyNote', () => {
  it('returns a different object reference', () => {
    const original = makeNote();
    const copy = copyNote(original);
    expect(copy).not.toBe(original);
  });

  it('copies all scalar fields correctly', () => {
    const original = makeNote();
    const copy = copyNote(original);
    expect(copy.id).toBe(original.id);
    expect(copy.summary).toBe(original.summary);
    expect(copy.timestamp).toBe(original.timestamp);
  });

  it('deep-copies action_items — mutating the copy does not affect the original', () => {
    const original = makeNote();
    const copy = copyNote(original);
    copy.action_items[0].text = 'Changed';
    expect(original.action_items[0].text).toBe('Do something');
  });

  it('deep-copies people array', () => {
    const original = makeNote();
    const copy = copyNote(original);
    copy.people.push('Bob');
    expect(original.people).toEqual(['Alice']);
  });

  it('deep-copies topics array', () => {
    const original = makeNote();
    const copy = copyNote(original);
    copy.topics.push('Topic B');
    expect(original.topics).toEqual(['Topic A']);
  });

  it('deep-copies decisions array', () => {
    const original = makeNote();
    const copy = copyNote(original);
    copy.decisions.push('Cancel');
    expect(original.decisions).toEqual(['Go ahead']);
  });

  it('handles empty arrays without throwing', () => {
    const original = makeNote({
      people: [], topics: [],
      decisions: [], action_items: [],
    });
    expect(() => copyNote(original)).not.toThrow();
  });
});
