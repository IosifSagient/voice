// One selectable chip in the notes-list tag filter bar. `key` is what
// identifies/compares a chip (person: normalized name key; topic: the
// canonical display label itself, already deduped by stem — see
// lib/noteTags.ts) — `label` is always what's rendered.
export type TagChip =
  | { kind: "person"; key: string; label: string }
  | { kind: "topic"; key: string; label: string };
