// Unit coverage for the shared pure matchers (src/lib/tagMatch.ts) — the
// single definition db/notesRead.js's getNotesByTag('topic', …) and the
// notes-list screen's client-side chip filter both call. See
// __tests__/topicTagNormalization.test.js for the getNotesByTag-level
// regression coverage this mirrors.
import { topicTagMatches, personKeyMatches } from "../src/lib/tagMatch";
import { normalizePersonName } from "../src/normalizeName";

describe("topicTagMatches", () => {
  it("finds a multi-word tag by a single-word query (word-boundary subset match)", () => {
    expect(topicTagMatches("φόρος", ["φόρος εισοδήματος"])).toBe(true);
  });

  it("does not let a word-boundary false positive through — 'λήση' inside 'πώληση'", () => {
    expect(topicTagMatches("λήση", ["πώληση κλιβάνων"])).toBe(false);
  });

  it("bridges Greek inflection (accent/case/final-sigma) between query and tag", () => {
    expect(topicTagMatches("κλιβάνους", ["ΚΛΊΒΑΝΟΣ"])).toBe(true);
  });

  it("returns false when none of the note's topics match", () => {
    expect(topicTagMatches("αυτοκίνητο", ["φόρος εισοδήματος"])).toBe(false);
  });
});

describe("personKeyMatches", () => {
  it("matches when the display name normalizes to the same key", () => {
    const key = normalizePersonName("Παπαδόπουλος").key;
    expect(personKeyMatches(key, "Παπαδόπουλος")).toBe(true);
  });

  it("matches regardless of honorific/case differences in the compared display name", () => {
    const key = normalizePersonName("Παπαδόπουλος").key;
    expect(personKeyMatches(key, "ΠΑΠΑΔΌΠΟΥΛΟΣ")).toBe(true);
  });

  it("does not match a different person", () => {
    const key = normalizePersonName("Παπαδόπουλος").key;
    expect(personKeyMatches(key, "Γιαννόπουλος")).toBe(false);
  });

  it("a shorter name's key does not false-match a longer, distinct name it's a literal prefix of", () => {
    const shortKey = normalizePersonName("Anna").key; // "anna" — a literal string prefix of "annabel"
    expect(personKeyMatches(shortKey, "Annabel")).toBe(false);
  });
});
