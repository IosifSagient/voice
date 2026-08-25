import { deriveTagChips, noteMatchesChip } from "../src/lib/noteTags";
import type { Note } from "../src/types/note";

let counter = 0;
function mkNote(overrides: Partial<Note> = {}): Note {
  counter += 1;
  return {
    id: `note-${counter}`,
    timestamp: 0,
    transcript: "",
    summary: `note-${counter}`,
    people: [],
    topics: [],
    decisions: [],
    action_items: [],
    ...overrides,
  };
}

beforeEach(() => {
  counter = 0;
});

describe("deriveTagChips", () => {
  it("derives distinct person chips across notes, deduped by normalized key, display from first occurrence", () => {
    const notes = [
      mkNote({ people: ["Παπαδόπουλος"] }),
      mkNote({ people: ["ΠΑΠΑΔΌΠΟΥΛΟΣ"] }), // same person, different casing/accents — one chip
      mkNote({ people: ["Γιαννόπουλος"] }),
    ];

    const chips = deriveTagChips(notes).filter((c) => c.kind === "person");

    expect(chips.map((c) => c.label)).toEqual(["Παπαδόπουλος", "Γιαννόπουλος"]);
  });

  it("derives distinct topic chips across notes, deduped by stem, canonical display chosen", () => {
    const notes = [
      mkNote({ topics: ["κλίβανος"] }),
      mkNote({ topics: ["κλιβάνους"] }), // same stem, different inflection — one chip
      mkNote({ topics: ["φόρος εισοδήματος"] }),
    ];

    const chips = deriveTagChips(notes).filter((c) => c.kind === "topic");

    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.label)).toContain("φόρος εισοδήματος");
  });

  it("returns no chips for a snapshot with no people/topics", () => {
    expect(deriveTagChips([mkNote()])).toEqual([]);
  });
});

describe("noteMatchesChip", () => {
  it("a topic chip matches a note whose topics word-boundary-subset-match it", () => {
    const note = mkNote({ topics: ["φόρος εισοδήματος"] });
    const [chip] = deriveTagChips([note]).filter((c) => c.kind === "topic");

    expect(noteMatchesChip(note, chip)).toBe(true);
    expect(noteMatchesChip(mkNote({ topics: ["αυτοκίνητο"] }), chip)).toBe(false);
  });

  it("a person chip matches only notes containing that exact normalized person", () => {
    const note = mkNote({ people: ["Παπαδόπουλος"] });
    const [chip] = deriveTagChips([note]).filter((c) => c.kind === "person");

    expect(noteMatchesChip(note, chip)).toBe(true);
    expect(noteMatchesChip(mkNote({ people: ["Γιαννόπουλος"] }), chip)).toBe(false);
  });
});
