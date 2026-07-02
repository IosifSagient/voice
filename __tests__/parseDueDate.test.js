const { parseDueDate } = require('../src/db');

describe('parseDueDate', () => {
  // null / empty inputs
  it('returns null for null', () => {
    expect(parseDueDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseDueDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDueDate('')).toBeNull();
  });

  it('returns null for a string without a recognisable date', () => {
    expect(parseDueDate('not-a-date')).toBeNull();
  });

  // valid plain dates
  it('parses a plain YYYY-MM-DD to UTC midnight ms', () => {
    const result = parseDueDate('2025-07-10');
    expect(result).toBe(Date.UTC(2025, 6, 10)); // month is 0-indexed
  });

  it('parses a datetime ISO string using only the date part', () => {
    // Time component must be ignored; result is still UTC midnight
    const result = parseDueDate('2025-07-10T15:30:00.000Z');
    expect(result).toBe(Date.UTC(2025, 6, 10));
  });

  // edge: Feb 28 in a non-leap year
  it('parses 28 Feb in a non-leap year correctly', () => {
    expect(parseDueDate('2025-02-28')).toBe(Date.UTC(2025, 1, 28));
  });

  // edge: Feb 29 in a leap year
  it('parses 29 Feb in a leap year correctly', () => {
    expect(parseDueDate('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
  });

  // edge: Dec 31 (year boundary)
  it('parses 31 Dec without rolling into the next year', () => {
    const result = parseDueDate('2025-12-31');
    expect(result).toBe(Date.UTC(2025, 11, 31));
    // Verify it is NOT Jan 1 2026
    expect(new Date(result).getUTCFullYear()).toBe(2025);
    expect(new Date(result).getUTCMonth()).toBe(11);
    expect(new Date(result).getUTCDate()).toBe(31);
  });

  // result is always at UTC midnight (time = 00:00:00.000)
  it('result is always UTC midnight regardless of input time', () => {
    const result = parseDueDate('2025-03-15T23:59:59+05:30');
    const d = new Date(result);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });
});
