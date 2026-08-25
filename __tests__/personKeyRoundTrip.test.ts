// Round-trip equivalence test for personKeyMatches's core assumption
// (lib/tagMatch.ts): recomputing a person's key from their DISPLAY name via
// normalizePersonName reproduces the exact key the WRITE path stored in
// people_normalized_json. Drives this through the real write-side function —
// normalizeAndDedupeNames (db/shared.js), which is what notesWrite.js's
// saveNote() actually calls to build people_normalized_json — rather than a
// hand-written key, so this test breaks the moment write-side and
// match-side normalization ever diverge. This is the historically
// bug-prone Greek-honorific path (see __tests__/personTagEndToEnd.test.js).
import { normalizeAndDedupeNames } from "../src/db/shared";
import { personKeyMatches } from "../src/lib/tagMatch";

// One raw name as it would arrive in an extraction's `people` array, BEFORE
// write-side normalization. A single-name array so dedup can't merge
// anything away — isolates each raw form's own write-side {key, display}.
function storedEntryFor(rawName: string) {
  const [entry] = normalizeAndDedupeNames([rawName]);
  return entry;
}

describe("personKeyMatches — write-side round trip", () => {
  // Honorific forms actually listed in normalizeName.ts's HONORIFICS set —
  // "κ" (with/without trailing dot), "κυριε", "δρ" — all of which should
  // collapse to the SAME stored key/display as the bare name.
  const sameNameVariants = [
    "Γιάννης", // plain, no honorific
    "κ. Γιάννης", // "κ" honorific, trailing dot
    "κ Γιάννης", // "κ" honorific, no dot
    "κύριε Γιάννης", // "κυριε" honorific
    "Δρ. Γιάννης", // "δρ" honorific, trailing dot
  ];

  it.each(sameNameVariants)(
    "recomputing from the write-side display for %s reproduces the stored key",
    (raw) => {
      const stored = storedEntryFor(raw);
      expect(personKeyMatches(stored.key, stored.display)).toBe(true);
    },
  );

  it("all honorific variants of the same person normalize to the same stored key/display", () => {
    const stored = sameNameVariants.map(storedEntryFor);
    expect(new Set(stored.map((s) => s.key)).size).toBe(1);
    expect(new Set(stored.map((s) => s.display)).size).toBe(1);
    expect(stored[0].display).toBe("Γιάννης");
  });

  it("holds for an accented, final-sigma name (exercises toKey's ς→σ folding)", () => {
    const stored = storedEntryFor("Παπαδόπουλος");
    expect(personKeyMatches(stored.key, stored.display)).toBe(true);
  });

  it("holds for an honorific-bearing accented name — 'κυρία Μαρία' ('κα'/'κυρια' honorific form)", () => {
    const stored = storedEntryFor("κυρία Μαρία");
    expect(stored.display).toBe("Μαρία");
    expect(personKeyMatches(stored.key, stored.display)).toBe(true);
  });

  it("does not false-match a distinct name whose stored key is a literal string prefix of another's", () => {
    const gianna = storedEntryFor("Γιάννα");
    const giannakis = storedEntryFor("Γιαννάκης");

    // Confirm the fixture actually exercises a prefix relationship (not
    // just two unrelated strings) before asserting on it.
    expect(giannakis.key.startsWith(gianna.key)).toBe(true);
    expect(gianna.key).not.toEqual(giannakis.key);

    expect(personKeyMatches(gianna.key, giannakis.display)).toBe(false);
    expect(personKeyMatches(giannakis.key, gianna.display)).toBe(false);
  });
});
