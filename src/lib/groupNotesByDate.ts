import type { Note, NoteListItem } from "../types/note";
import { toLocalDateString } from "./localDate";

type BucketKey = "today" | "thisWeek" | "older";

const BUCKET_LABELS: Record<BucketKey, string> = {
  today: "Σήμερα",
  thisWeek: "Αυτή την εβδομάδα",
  older: "Παλαιότερα",
};

// Groups notes (already created_at DESC, per db/notesRead.js) under date
// headers, without disturbing that order — a header is only emitted for a
// bucket that actually has notes in it.
//
// "This week" starts Monday 00:00 local of `now`'s week, computed via local
// Date-constructor arithmetic (getFullYear/getMonth/getDate - offset), the
// same DST-safe pattern services/taskBuckets.ts uses for its +7 day cutoff —
// a fixed-millis offset (now.getTime() - N*86400000) shifts by an hour across
// a DST transition, which can land on the wrong calendar day near midnight.
export function groupNotesByDate(notes: Note[], now: Date = new Date()): NoteListItem[] {
  const todayLocal = toLocalDateString(now);

  const jsDay = now.getDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (jsDay + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const mondayLocal = toLocalDateString(monday);

  const buckets: Record<BucketKey, Note[]> = { today: [], thisWeek: [], older: [] };

  for (const note of notes) {
    const noteLocal = toLocalDateString(new Date(note.timestamp));
    // >= todayLocal (not ===) so a note whose local date is somehow ahead of
    // `now` (e.g. `now` captured slightly stale) still lands in "today"
    // rather than falling through to "older".
    if (noteLocal >= todayLocal) {
      buckets.today.push(note);
    } else if (noteLocal >= mondayLocal) {
      buckets.thisWeek.push(note);
    } else {
      buckets.older.push(note);
    }
  }

  const items: NoteListItem[] = [];
  (["today", "thisWeek", "older"] as const).forEach((key) => {
    if (buckets[key].length === 0) return;
    items.push({ type: "header", key: `header-${key}`, label: BUCKET_LABELS[key] });
    for (const note of buckets[key]) {
      items.push({ type: "note", key: note.id, note });
    }
  });

  return items;
}
