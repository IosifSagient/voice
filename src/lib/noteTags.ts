import { normalizeAndDedupeNames, canonicalizeTopics } from "../db/shared";
import { topicTagMatches, personKeyMatches } from "./tagMatch";
import { toKey } from "./textNormalize";
import type { Note } from "../types/note";
import type { TagChip } from "../types/tags";

// Distinct person/topic chips across a whole note set, for the notes-list
// filter bar. Reuses the exact same dedup rules the write path already
// applies within one note (db/shared.js) — cross-note dedup is the identical
// operation, just fed the concatenation of every note's tags instead of one
// note's raw extraction:
//   - people: normalizeAndDedupeNames, keyed by normalized name (first
//     display wins ties, same as a single note's own people list).
//   - topics: canonicalizeTopics, keyed by stemKey (first/shortest display
//     wins ties, same as a single note's own topic list) — see its comment
//     in db/shared.js for why "within one note" and "across notes" collapse
//     to the same grouping rule.
export function deriveTagChips(notes: Note[]): TagChip[] {
  const people = normalizeAndDedupeNames(notes.flatMap((n) => n.people)).map(
    ({ key, display }): TagChip => ({ kind: "person", key, label: display }),
  );
  const topics = canonicalizeTopics(notes.flatMap((n) => n.topics)).map(
    (label): TagChip => ({ kind: "topic", key: label, label }),
  );
  return [...people, ...topics].sort(compareByGreekLabel);
}

// Alphabetical by display label, via toKey() (accent-strip → lowercase →
// final-sigma fold) rather than Intl.Collator — on-device Hermes support for
// Intl.Collator('el') is unverified, while toKey()'s output sorts correctly
// within the Greek block by plain code-point compare. Raw-label tiebreak is
// only reachable across kinds (e.g. a person and a topic both named
// "Αθήνα") — within one kind, normalizeAndDedupeNames/canonicalizeTopics
// already dedupe by a key derived from toKey, so two chips of the same kind
// can never tie here.
function compareByGreekLabel(a: TagChip, b: TagChip): number {
  const ka = toKey(a.label);
  const kb = toKey(b.label);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

// Whether `note` matches the active chip — dispatches to the matching rule
// for the chip's kind. Topic uses the stemKey subset match (same function
// db/notesRead.js's getNotesByTag uses); person uses exact normalized-key
// equality (NOT the SQL LIKE substring db/notesRead.js uses — see
// lib/tagMatch.ts for why the client-side filter is stricter).
export function noteMatchesChip(note: Note, chip: TagChip): boolean {
  if (chip.kind === "topic") return topicTagMatches(chip.label, note.topics);
  return note.people.some((p) => personKeyMatches(chip.key, p));
}
