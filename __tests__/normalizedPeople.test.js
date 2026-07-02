const { normalizeAndDedupeNames } = require('../src/db');

describe('normalizeAndDedupeNames', () => {
  it('dedupes "Δρ. Παπαδόπουλος" and "κ. Παπαδόπουλος" into a single {key,display} entry', () => {
    const result = normalizeAndDedupeNames(['Δρ. Παπαδόπουλος', 'κ. Παπαδόπουλος']);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('παπαδοπουλοσ');
    expect(result[0].display).toBe('Παπαδόπουλος');
  });
});
