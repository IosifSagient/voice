const GREEK_MONTHS = [
  "Ιαν",
  "Φεβ",
  "Μαρ",
  "Απρ",
  "Μαΐ",
  "Ιουν",
  "Ιουλ",
  "Αυγ",
  "Σεπ",
  "Οκτ",
  "Νοε",
  "Δεκ",
];

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = d.getDate();
  const month = GREEK_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${year}`;
}

export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const day = d.getDate();
  const month = GREEK_MONTHS[d.getMonth()];
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month}, ${h}:${m}`;
}

const GREEK_MONTHS_GENITIVE = [
  "Ιανουαρίου",
  "Φεβρουαρίου",
  "Μαρτίου",
  "Απριλίου",
  "Μαΐου",
  "Ιουνίου",
  "Ιουλίου",
  "Αυγούστου",
  "Σεπτεμβρίου",
  "Οκτωβρίου",
  "Νοεμβρίου",
  "Δεκεμβρίου",
];

const DUE_DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Formats an action item's "YYYY-MM-DD" due_date as Greek "<day> <genitive
// month>" (e.g. "15 Σεπτεμβρίου") — no year, deliberately: this stays a pure
// function with no clock read, unlike formatDate's "this year vs other year"
// check above. Parses the string directly (split, no `new Date()`) to avoid
// timezone/off-by-one entirely. Returns null on anything not cleanly
// "YYYY-MM-DD" — never throws, never emits a garbled date.
export function formatDueDate(
  dueDate: string | null | undefined,
): string | null {
  if (!dueDate) return null;
  const match = DUE_DATE_SHAPE.exec(dueDate);
  if (!match) return null;
  const day = Number(match[3]);
  const month = GREEK_MONTHS_GENITIVE[Number(match[2]) - 1];
  if (!month || day < 1 || day > 31) return null;
  return `${day} ${month}`;
}

// Module-level formatters (Hermes ships Intl on RN 0.81 / SDK 54) — built once,
// not per row. Greek locale to match formatDate.
const railDayFmt = new Intl.DateTimeFormat("el-GR", { day: "numeric" });
const railMonthFmt = new Intl.DateTimeFormat("el-GR", { month: "short" });

// Rail parts for the timeline row. Always the concrete numeric date — the
// relative "Σήμερα/Παλαιότερα" bucket is the section header's job, not the rail's.
export function formatDateRail(timestamp: number | string | Date): {
  day: string;
  month: string;
} {
  const d = new Date(timestamp);
  return { day: railDayFmt.format(d), month: railMonthFmt.format(d) };
}

// Stable per-day key (local time) for same-day rail suppression.
export function dateKeyOf(timestamp: number | string | Date): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
