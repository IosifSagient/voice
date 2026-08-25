// Pin the process's local timezone to Europe/Athens BEFORE any Date is
// constructed, so toLocalDateString's local-getter derivation is testable
// deterministically regardless of the machine/CI running this suite — same
// rationale as __tests__/taskBuckets.test.ts, which this file's DST case
// mirrors.
process.env.TZ = "Europe/Athens";

import { groupNotesByDate } from "../src/lib/groupNotesByDate";
import type { Note } from "../src/types/note";

let counter = 0;
function mkNote(timestamp: number, overrides: Partial<Note> = {}): Note {
  counter += 1;
  return {
    id: `note-${counter}`,
    timestamp,
    transcript: "",
    summary: `note-${counter}`,
    people: [],
    topics: [],
    decisions: [],
    action_items: [],
    ...overrides,
  };
}

// Flattens the result into a compact, order-preserving shape for assertions:
// "header:<label>" for a header row, the note's id for a note row.
function summarize(items: ReturnType<typeof groupNotesByDate>): string[] {
  return items.map((item) => (item.type === "header" ? `header:${item.label}` : item.note.id));
}

beforeEach(() => {
  counter = 0;
});

describe("groupNotesByDate", () => {
  it("buckets a note created today under Σήμερα only", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0); // Wed 2026-07-08, local
    const todayNote = mkNote(new Date(2026, 6, 8, 14, 0, 0).getTime());

    const items = groupNotesByDate([todayNote], now);

    expect(summarize(items)).toEqual(["header:Σήμερα", todayNote.id]);
  });

  it("buckets a note from earlier this week (before today, same week) under Αυτή την εβδομάδα", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0); // Wed 2026-07-08, local
    const mondayNote = mkNote(new Date(2026, 6, 6, 9, 0, 0).getTime()); // Mon 2026-07-06
    const tuesdayNote = mkNote(new Date(2026, 6, 7, 18, 0, 0).getTime()); // Tue 2026-07-07

    const items = groupNotesByDate([mondayNote, tuesdayNote], now);

    expect(summarize(items)).toEqual([
      "header:Αυτή την εβδομάδα",
      mondayNote.id,
      tuesdayNote.id,
    ]);
  });

  it("treats Monday 00:00:00.000 local as the inclusive start of the current week", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0); // Wed 2026-07-08, local — Monday of this week is 2026-07-06
    const exactlyMonday = mkNote(new Date(2026, 6, 6, 0, 0, 0, 0).getTime());
    const oneMsBeforeMonday = mkNote(new Date(2026, 6, 5, 23, 59, 59, 999).getTime());

    const items = groupNotesByDate([exactlyMonday, oneMsBeforeMonday], now);

    expect(summarize(items)).toEqual([
      "header:Αυτή την εβδομάδα",
      exactlyMonday.id,
      "header:Παλαιότερα",
      oneMsBeforeMonday.id,
    ]);
  });

  it("buckets a note from well before this week's Monday under Παλαιότερα", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0); // Wed 2026-07-08, local
    const olderNote = mkNote(new Date(2026, 5, 20, 12, 0, 0).getTime()); // 2026-06-20

    const items = groupNotesByDate([olderNote], now);

    expect(summarize(items)).toEqual(["header:Παλαιότερα", olderNote.id]);
  });

  it("computes this week's Monday via local calendar arithmetic across the Europe/Athens DST fall-back", () => {
    // 2026-10-25 is a Sunday — the EU DST fall-back date (clocks go back from
    // EEST/UTC+3 to EET/UTC+2 at 04:00 local). `now` sits after the
    // fall-back, on that Sunday evening; the Monday that starts this same
    // week (2026-10-19) sits before it. A naive fixed-millis week-start
    // computation (now.getTime() - N*86400000) would drift by an hour across
    // that transition and could misclassify the Monday-midnight note as the
    // wrong calendar day; the local Date-constructor arithmetic
    // (getFullYear/getMonth/getDate - offset) groupNotesByDate actually uses
    // does not.
    const now = new Date(2026, 9, 25, 20, 0, 0); // Sun 2026-10-25 20:00 local, post-fallback
    const mondayMidnight = mkNote(new Date(2026, 9, 19, 0, 0, 0, 0).getTime()); // Mon 2026-10-19 00:00 local
    const sundayBeforeMonday = mkNote(new Date(2026, 9, 18, 23, 59, 59, 999).getTime()); // Sun 2026-10-18

    const items = groupNotesByDate([mondayMidnight, sundayBeforeMonday], now);

    expect(summarize(items)).toEqual([
      "header:Αυτή την εβδομάδα",
      mondayMidnight.id,
      "header:Παλαιότερα",
      sundayBeforeMonday.id,
    ]);
  });

  it("only renders headers for non-empty buckets, and preserves the incoming created_at DESC order within and across buckets", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0); // Wed 2026-07-08, local — no Παλαιότερα notes in this case
    const today1 = mkNote(new Date(2026, 6, 8, 16, 0, 0).getTime());
    const today2 = mkNote(new Date(2026, 6, 8, 9, 0, 0).getTime());
    const thisWeek1 = mkNote(new Date(2026, 6, 7, 12, 0, 0).getTime());

    // Passed in already created_at DESC, as db/notesRead.js's getAllNotes
    // returns them.
    const items = groupNotesByDate([today1, today2, thisWeek1], now);

    expect(summarize(items)).toEqual([
      "header:Σήμερα",
      today1.id,
      today2.id,
      "header:Αυτή την εβδομάδα",
      thisWeek1.id,
    ]);
  });

  it("returns an empty array for an empty notes list", () => {
    const now = new Date(2026, 6, 8, 10, 0, 0);
    expect(groupNotesByDate([], now)).toEqual([]);
  });
});
