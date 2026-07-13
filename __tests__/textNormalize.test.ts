import { stripDiacritics, toKey } from '../src/lib/textNormalize';

describe('stripDiacritics', () => {
  it('strips Greek accents', () => {
    expect(stripDiacritics('ώρα')).toBe('ωρα');
  });

  it('leaves unaccented text untouched', () => {
    expect(stripDiacritics('ωρα')).toBe('ωρα');
  });

  it('leaves Latin text untouched', () => {
    expect(stripDiacritics('hello')).toBe('hello');
  });

  it('returns an empty string for an empty string', () => {
    expect(stripDiacritics('')).toBe('');
  });
});

describe('toKey', () => {
  it('strips accents and lowercases: ώρα → ωρα', () => {
    expect(toKey('ώρα')).toBe('ωρα');
  });

  it('uppercase collapses to the same key: ΏΡΑ → ωρα', () => {
    expect(toKey('ΏΡΑ')).toBe('ωρα');
  });

  it('folds final sigma (ς → σ): Παπαδόπουλος ends in σ, not ς', () => {
    const result = toKey('Παπαδόπουλος');
    expect(result.endsWith('σ')).toBe(true);
    expect(result.endsWith('ς')).toBe(false);
    expect(result).toBe('παπαδοπουλοσ');
  });

  it('mixed Latin/Greek text is normalized as a single string', () => {
    expect(toKey('Δρ. Smith')).toBe('δρ. smith');
  });

  it('returns an empty string for an empty string', () => {
    expect(toKey('')).toBe('');
  });
});
