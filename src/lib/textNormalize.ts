// Generic Greek/Latin text-normalization primitives — no honorific handling,
// which is people-specific and lives in normalizeName.ts. Shared by person-name
// deduplication (normalizeName.ts) and FTS5 search-query normalization.

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "");
}

// Diacritic-free, lowercase, final-sigma folded (ς → σ).
export function toKey(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/ς/g, "σ");
}
