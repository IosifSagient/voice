import { formatDate, formatDateTime } from '../src/lib/dateFormat';

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
