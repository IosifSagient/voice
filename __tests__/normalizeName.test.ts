import { normalizePersonName } from '../src/lib/normalizeName';

// ── helpers ──────────────────────────────────────────────────────────────────

function key(raw: string) {
  return normalizePersonName(raw).key;
}
function display(raw: string) {
  return normalizePersonName(raw).display;
}

// ── core collapse: five variants of the same surname share one key ────────────

describe('honorific stripping + key collapse', () => {
  const TARGET_KEY = key('Παπαδόπουλος');

  it('"Δρ. Παπαδόπουλος" collapses to the same key', () => {
    expect(key('Δρ. Παπαδόπουλος')).toBe(TARGET_KEY);
  });

  it('"Δρ Παπαδόπουλος" (no dot) collapses to the same key', () => {
    expect(key('Δρ Παπαδόπουλος')).toBe(TARGET_KEY);
  });

  it('"Παπαδόπουλος" (no honorific) collapses to the same key', () => {
    expect(key('Παπαδόπουλος')).toBe(TARGET_KEY);
  });

  it('"παπαδόπουλος" (lowercase) collapses to the same key', () => {
    expect(key('παπαδόπουλος')).toBe(TARGET_KEY);
  });

  it('"  Παπαδόπουλος  " (extra whitespace) collapses to the same key', () => {
    expect(key('  Παπαδόπουλος  ')).toBe(TARGET_KEY);
  });
});

// ── display: casing and accents preserved as-is; honorific removed ───────────

describe('display field', () => {
  it('removes the honorific from display', () => {
    expect(display('Δρ. Παπαδόπουλος')).toBe('Παπαδόπουλος');
    expect(display('Δρ Παπαδόπουλος')).toBe('Παπαδόπουλος');
  });

  it('preserves original casing in display (no title-casing applied)', () => {
    expect(display('παπαδόπουλος')).toBe('παπαδόπουλος');
  });

  it('trims leading/trailing whitespace in display', () => {
    expect(display('  Παπαδόπουλος  ')).toBe('Παπαδόπουλος');
  });

  it('collapses internal whitespace in display', () => {
    expect(display('Παπαδόπουλος   Νίκος')).toBe('Παπαδόπουλος Νίκος');
  });

  it('preserves accents in display', () => {
    expect(display('Παπαδόπουλος')).toBe('Παπαδόπουλος');
  });
});

// ── negative: distinct names do NOT share a key ──────────────────────────────

describe('distinct names stay distinct', () => {
  it('"Παπαδόπουλος" and "Γεωργίου" have different keys', () => {
    expect(key('Παπαδόπουλος')).not.toBe(key('Γεωργίου'));
  });

  it('"Νίκος" and "Νίκη" have different keys', () => {
    expect(key('Νίκος')).not.toBe(key('Νίκη'));
  });
});

// ── final sigma fold: ς and σ must produce the same key ──────────────────────

describe('final sigma fold', () => {
  it('"ΠΑΠΑΔΟΠΟΥΛΟΣ" (all-caps, final sigma) shares the key with "Παπαδόπουλος"', () => {
    // Greek uppercase has no final-sigma distinction; lowercasing "ΠΑΠΑΔΟΠΟΥΛΟΣ"
    // gives "παπαδόπουλος" (non-final σ throughout), which must equal the key
    // produced from the mixed-case "Παπαδόπουλος" (which ends in ς).
    expect(key('ΠΑΠΑΔΟΠΟΥΛΟΣ')).toBe(key('Παπαδόπουλος'));
  });

  it('"Γεωργίου" vs "ΓΕΩΡΓΙΟΥ" share the same key', () => {
    expect(key('ΓΕΩΡΓΙΟΥ')).toBe(key('Γεωργίου'));
  });
});

// ── empty-honorific guard ─────────────────────────────────────────────────────

describe('empty result guard', () => {
  it('"Δρ." alone does NOT produce an empty display — falls back to trimmed original', () => {
    const d = display('Δρ.');
    expect(d.length).toBeGreaterThan(0);
    expect(d).toBe('Δρ.');
  });

  it('"κ." alone falls back to trimmed original', () => {
    const d = display('κ.');
    expect(d.length).toBeGreaterThan(0);
    expect(d).toBe('κ.');
  });
});

// ── false-positive guard: prefix must be followed by whitespace ───────────────

describe('false-positive guard', () => {
  it('"Καραγιάννης" is NOT stripped (κα- is not an honorific without a space after)', () => {
    expect(display('Καραγιάννης')).toBe('Καραγιάννης');
  });

  it('"Κυρίτσης" is NOT stripped (κυρι- embedded in name)', () => {
    expect(display('Κυρίτσης')).toBe('Κυρίτσης');
  });

  it('"Δρόσος" is NOT stripped (δρ- is a name prefix, not followed by space)', () => {
    expect(display('Δρόσος')).toBe('Δρόσος');
  });
});

// ── other Greek honorifics ────────────────────────────────────────────────────

describe('other honorific prefixes are stripped', () => {
  it('strips "κ." (kyrios abbreviation)', () => {
    expect(display('κ. Παπαδόπουλος')).toBe('Παπαδόπουλος');
  });

  it('strips "κα" (kyria abbreviation, with space)', () => {
    expect(display('κα Παπαδοπούλου')).toBe('Παπαδοπούλου');
  });

  it('strips "κα." (kyria abbreviation with dot)', () => {
    expect(display('κα. Παπαδοπούλου')).toBe('Παπαδοπούλου');
  });

  it('strips "Prof." (Latin honorific)', () => {
    expect(display('Prof. Smith')).toBe('Smith');
  });

  it('strips "Dr." (Latin honorific)', () => {
    expect(display('Dr. Smith')).toBe('Smith');
  });

  it('strips "Mr." (Latin honorific)', () => {
    expect(display('Mr. Smith')).toBe('Smith');
  });
});
