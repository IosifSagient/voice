import { formatDate, formatDateTime, formatDueDate } from '../src/lib/dateFormat';

// Pin "now" so same-year vs cross-year logic is deterministic.
// formatDate reads `new Date()` internally, so we mock the global Date constructor.
const CURRENT_YEAR = 2025;

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${CURRENT_YEAR}-06-15T12:00:00.000Z`));
});

afterAll(() => {
  jest.useRealTimers();
});

describe('formatDate', () => {
  it('formats a same-year date without the year', () => {
    // 3 March 2025
    const ts = new Date('2025-03-03T10:00:00.000Z').getTime();
    expect(formatDate(ts)).toBe('3 Μαρ');
  });

  it('formats a cross-year date including the year', () => {
    const ts = new Date('2023-11-21T10:00:00.000Z').getTime();
    expect(formatDate(ts)).toBe('21 Νοε 2023');
  });

  it('uses correct Greek month abbreviations for all 12 months', () => {
    const months = [
      'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν',
      'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ',
    ];
    months.forEach((abbr, i) => {
      const ts = new Date(2023, i, 10).getTime(); // 2023 = cross-year
      expect(formatDate(ts)).toContain(abbr);
    });
  });
});

describe('formatDateTime', () => {
  it('formats hour and minute with zero-padding', () => {
    // 5 May 2025 09:04 local
    const ts = new Date(2025, 4, 5, 9, 4).getTime();
    expect(formatDateTime(ts)).toMatch(/09:04/);
  });

  it('includes day and Greek month abbreviation', () => {
    const ts = new Date(2025, 5, 1, 14, 30).getTime(); // 1 June
    const result = formatDateTime(ts);
    expect(result).toContain('1 Ιουν');
    expect(result).toContain('14:30');
  });

  it('never includes the year', () => {
    const ts = new Date(2019, 0, 1, 8, 0).getTime();
    expect(formatDateTime(ts)).not.toMatch(/\d{4}/);
  });
});

describe('formatDueDate', () => {
  it('formats a valid date as day + genitive month', () => {
    expect(formatDueDate('2025-09-15')).toBe('15 Σεπτεμβρίου');
  });

  it('strips the leading zero from a single-digit day', () => {
    expect(formatDueDate('2025-09-05')).toBe('5 Σεπτεμβρίου');
  });

  it('uses the correct genitive month name across quarters', () => {
    expect(formatDueDate('2025-01-10')).toBe('10 Ιανουαρίου');
    expect(formatDueDate('2025-04-10')).toBe('10 Απριλίου');
    expect(formatDueDate('2025-07-10')).toBe('10 Ιουλίου');
    expect(formatDueDate('2025-10-10')).toBe('10 Οκτωβρίου');
  });

  it('never includes the year', () => {
    expect(formatDueDate('2025-09-15')).not.toMatch(/2025/);
  });

  it('returns null for null, undefined, and empty input', () => {
    expect(formatDueDate(null)).toBeNull();
    expect(formatDueDate(undefined)).toBeNull();
    expect(formatDueDate('')).toBeNull();
  });

  it('returns null for a malformed date string', () => {
    expect(formatDueDate('15/09/2025')).toBeNull();
    expect(formatDueDate('2025-9-15')).toBeNull();
    expect(formatDueDate('not-a-date')).toBeNull();
  });

  it('returns null for an out-of-range month (13th month, or month 0)', () => {
    expect(formatDueDate('2025-13-01')).toBeNull();
    expect(formatDueDate('2025-00-01')).toBeNull();
  });

  it('does not throw on garbage input', () => {
    expect(() => formatDueDate('garbage')).not.toThrow();
  });
});
