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

  it('iso.slice(0, 10) follows the Athens calendar day, not UTC, near midnight', () => {
    // 2026-07-08T22:30:00Z is already 2026-07-09 01:30 in Athens (EEST, UTC+3
    // in July). agent.ts derives its "today" for overdue resolution from this
    // same iso.slice(0, 10) — if it silently fell back to the UTC date here,
    // overdue would be off by a day for ~3 hours around midnight.
    const { iso } = buildAnchor(new Date('2026-07-08T22:30:00.000Z'));
    expect(iso.slice(0, 10)).toBe('2026-07-09');
  });
});
