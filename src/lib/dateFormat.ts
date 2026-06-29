const GREEK_MONTHS = [
  "Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν",
  "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ",
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
