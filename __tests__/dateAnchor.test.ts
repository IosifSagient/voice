import { buildAnchor } from '../src/lib/dateAnchor';

// Fixed Wednesday 2 July 2025, 14:30 UTC → Athens is UTC+3 in summer,
// so local Athens time is 17:30 on the same day.
const FIXED = new Date('2025-07-02T14:30:00.000Z');

describe('buildAnchor', () => {
  it('returns an Athens ISO string matching the injected date', () => {
    const { iso } = buildAnchor(FIXED);
    // Athens is EEST (+03:00) in July; expect 17:30 local
    expect(iso).toMatch(/^2025-07-02T17:30:00/);
  });

  it('returns the correct English weekday for the injected date', () => {
    const { weekday } = buildAnchor(FIXED);
    expect(weekday).toBe('Wednesday');
  });

  it('calendarBlock contains the today marker on the right date', () => {
    const { calendarBlock } = buildAnchor(FIXED);
    expect(calendarBlock).toContain('Wednesday: 2025-07-02  ← today');
  });

  it('calendarBlock starts this week on Monday', () => {
    const { calendarBlock } = buildAnchor(FIXED);
    // Week containing 2025-07-02 (Wed) starts on Mon 2025-06-30
    const lines = calendarBlock.split('\n');
    expect(lines[0]).toBe('This week:');
    expect(lines[1]).toContain('Monday: 2025-06-30');
  });

  it('calendarBlock contains exactly two weeks', () => {
    const { calendarBlock } = buildAnchor(FIXED);
    expect(calendarBlock).toContain('This week:');
    expect(calendarBlock).toContain('Next week:');
    // 2 headers + 7 days each = 16 lines
    expect(calendarBlock.split('\n')).toHaveLength(16);
  });

  it('next week Monday is 7 days after this week Monday', () => {
    const { calendarBlock } = buildAnchor(FIXED);
    expect(calendarBlock).toContain('Monday: 2025-07-07');
  });

  it('only the current day gets the today marker', () => {
    const { calendarBlock } = buildAnchor(FIXED);
    const markedLines = calendarBlock.split('\n').filter(l => l.includes('← today'));
    expect(markedLines).toHaveLength(1);
  });

  it('defaults to now without throwing', () => {
    expect(() => buildAnchor()).not.toThrow();
  });
});
