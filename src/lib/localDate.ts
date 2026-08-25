// Local (device-timezone) YYYY-MM-DD, from Date getters — not toISOString(),
// which would give the UTC date and drift from the user's actual calendar
// day near midnight. Single canonical definition — services/taskBuckets.ts
// and lib/groupNotesByDate.ts both import this rather than each defining
// their own copy.
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
