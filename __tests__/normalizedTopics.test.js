const { canonicalizeTopics, stemKey } = require('../src/db');

describe('stemKey', () => {
  it('reduces a multi-word phrase word-wise, not as one whole string', () => {
    // Whole-string stemming would only ever strip the LAST word — this must
    // stem/keep each word independently so "φόρος" stays reachable on its own.
    expect(stemKey('φόρος εισοδήματος')).toEqual(['φοροσ', 'εισοδηματ']);
  });

  it('falls back to the plain toKey()\'d word when stemming is unsafe', () => {
    expect(stemKey('το')).toEqual(['το']);
  });
});

describe('canonicalizeTopics', () => {
  it('dedupes "κλίβανος" and "κλιβάνους" into a single entry, shortest variant wins', () => {
    const result = canonicalizeTopics(['κλίβανος', 'κλιβάνους']);
    expect(result).toEqual(['κλίβανος']);
  });

  it('keeps the first-seen variant when raw lengths tie', () => {
    // "κλιβάνου" (genitive singular) and "κλιβάνων" (genitive plural) are both
    // 8 characters and stem to the same key ("κλιβαν") — first-seen wins.
    const result = canonicalizeTopics(['κλιβάνου', 'κλιβάνων']);
    expect(result).toEqual(['κλιβάνου']);
  });

  it('leaves distinct topics untouched and in order', () => {
    const result = canonicalizeTopics(['διαβατήριο', 'φόρος εισοδήματος']);
    expect(result).toEqual(['διαβατήριο', 'φόρος εισοδήματος']);
  });

  it('falls back to exact toKey equality for short words below the stemming floor', () => {
    const result = canonicalizeTopics(['το', 'Το']);
    expect(result).toEqual(['το']);
  });

  it('drops blank/whitespace-only entries', () => {
    const result = canonicalizeTopics(['κλίβανος', '   ', '']);
    expect(result).toEqual(['κλίβανος']);
  });

  it('does not merge distinct multi-word phrases that share only one word', () => {
    // "φόρος εισοδήματος" and "φόρος ακινήτων" both contain "φόρος" but are
    // different concepts — the grouping key is the whole per-word stem
    // sequence, not just an overlapping word, so these must stay separate.
    const result = canonicalizeTopics(['φόρος εισοδήματος', 'φόρος ακινήτων']);
    expect(result).toEqual(['φόρος εισοδήματος', 'φόρος ακινήτων']);
  });

  it('is idempotent — running twice produces the same result', () => {
    const once = canonicalizeTopics(['κλίβανος', 'κλιβάνους']);
    const twice = canonicalizeTopics(once);
    expect(twice).toEqual(once);
  });
});
