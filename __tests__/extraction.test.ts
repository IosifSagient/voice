jest.mock('../src/services/openaiClient', () => ({
  openaiPost: jest.fn(),
}));

import { openaiPost } from '../src/services/openaiClient';
import { extractNote } from '../src/services/extraction';
import { EXTRACTION_MODEL } from '../src/config/models';

const mockPost = openaiPost as jest.Mock;

function respondWith(content: unknown) {
  mockPost.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(content) } }],
  });
}

async function extractShortTitle(shortTitle: unknown) {
  const action: Record<string, unknown> = { title: 'Κάλεσε τη Μαρία' };
  if (shortTitle !== undefined) action.short_title = shortTitle;
  respondWith({ actions: [action] });
  const { action_items } = await extractNote('transcript');
  return action_items[0].short_title;
}

describe('extractNote', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('short_title', () => {
    it('keeps a valid short title', async () => {
      await expect(extractShortTitle('Κλήση Μαρίας')).resolves.toBe('Κλήση Μαρίας');
    });

    it('is null when missing', async () => {
      await expect(extractShortTitle(undefined)).resolves.toBeNull();
    });

    it('is null when the model returns null', async () => {
      await expect(extractShortTitle(null)).resolves.toBeNull();
    });

    it.each([[''], ['   '], ['\n\t ']])('is null when empty or whitespace (%j)', async (value) => {
      await expect(extractShortTitle(value)).resolves.toBeNull();
    });

    it('keeps exactly 24 characters', async () => {
      const value = 'α'.repeat(24);
      await expect(extractShortTitle(value)).resolves.toBe(value);
    });

    it('is null at 25 characters, never truncated', async () => {
      await expect(extractShortTitle('α'.repeat(25))).resolves.toBeNull();
    });

    it.each([[42], [0], [true], [{ text: 'Κλήση' }], [['Κλήση']]])(
      'is null for a non-string (%j)',
      async (value) => {
        await expect(extractShortTitle(value)).resolves.toBeNull();
      },
    );

    it('trims surrounding whitespace', async () => {
      await expect(extractShortTitle('  Κλήση Μαρίας\n')).resolves.toBe('Κλήση Μαρίας');
    });

    it('applies the cap after trimming', async () => {
      const value = 'α'.repeat(24);
      await expect(extractShortTitle(`   ${value}   `)).resolves.toBe(value);
    });

    it('parses each action independently', async () => {
      respondWith({
        actions: [
          { title: 'A', short_title: 'Πρώτο' },
          { title: 'B', short_title: 'β'.repeat(25) },
          { title: 'C', short_title: 'Τρίτο' },
        ],
      });

      const { action_items } = await extractNote('transcript');
      expect(action_items.map((item) => item.short_title)).toEqual(['Πρώτο', null, 'Τρίτο']);
    });
  });

  describe('short_title dev logging', () => {
    const DEV = __DEV__;

    afterEach(() => {
      (globalThis as unknown as { __DEV__: boolean }).__DEV__ = DEV;
    });

    it('logs a kept title', async () => {
      await extractShortTitle('Κλήση Μαρίας');
      expect(logSpy).toHaveBeenCalledWith('[extraction:shortTitle] kept', {
        title: 'Κάλεσε τη Μαρία',
        shortTitle: 'Κλήση Μαρίας',
        length: 12,
      });
    });

    it.each([
      ['missing', undefined],
      ['not a string', 42],
      ['empty', '   '],
      ['too long (25)', 'α'.repeat(25)],
    ])('logs a rejection with its reason: %s', async (reason, value) => {
      await extractShortTitle(value);
      expect(logSpy).toHaveBeenCalledWith(
        '[extraction:shortTitle] rejected',
        reason,
        expect.objectContaining({ title: 'Κάλεσε τη Μαρία' }),
      );
    });

    it.each([['Κλήση Μαρίας'], ['α'.repeat(25)]])('logs nothing outside __DEV__ (%s)', async (value) => {
      (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
      await extractShortTitle(value);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('existing fields', () => {
    it('parses a full response as before', async () => {
      respondWith({
        summary: 'Περίληψη',
        people: ['Μαρία'],
        topics: ['δώρο'],
        actions: [
          {
            title: 'Κάλεσε τη Μαρία',
            short_title: 'Κλήση Μαρίας',
            date_reasoning: 'αύριο',
            due_date: '2026-11-01',
            due_time: '10:00',
            all_day: false,
            add_to_calendar: true,
          },
        ],
      });

      await expect(extractNote('transcript')).resolves.toEqual({
        summary: 'Περίληψη',
        people: ['Μαρία'],
        topics: ['δώρο'],
        action_items: [
          {
            text: 'Κάλεσε τη Μαρία',
            short_title: 'Κλήση Μαρίας',
            due_date: '2026-11-01',
            due_time: '10:00',
            all_day: false,
          },
        ],
      });
    });

    it('defaults missing action fields', async () => {
      respondWith({ actions: [{}] });

      const { action_items } = await extractNote('transcript');
      expect(action_items).toEqual([
        { text: '', short_title: null, due_date: null, due_time: null, all_day: true },
      ]);
    });

    it('defaults missing and malformed top-level fields', async () => {
      respondWith({ people: 'Μαρία', topics: null, actions: 'none' });

      await expect(extractNote('transcript')).resolves.toEqual({
        summary: '',
        people: [],
        topics: [],
        action_items: [],
      });
    });

    it('sends the transcript with the pinned model and JSON mode', async () => {
      respondWith({});
      await extractNote('το κείμενο');

      const [path, body] = mockPost.mock.calls[0];
      expect(path).toBe('/chat/completions');
      expect(body.model).toBe(EXTRACTION_MODEL);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'το κείμενο' });
    });

    it('asks for short_title in the system prompt', async () => {
      respondWith({});
      await extractNote('transcript');

      const system = mockPost.mock.calls[0][1].messages[0].content;
      expect(system).toContain('"short_title"');
      expect(system).toContain('RULES — SHORT TITLE');
    });
  });
});
