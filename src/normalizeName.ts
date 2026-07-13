import { toKey } from "./lib/textNormalize";

export type NormalizedName = {
  key: string; // accent-free, lowercase, σ-folded — for dedup/matching only
  display: string; // honorific stripped, whitespace collapsed, original casing+accents kept
};

// Stored in key-form: accent-free, lowercase, final-sigma folded (ς → σ).
// Each entry is what toKey() produces for that honorific.
const HONORIFICS = new Set([
  // Greek
  "δρ",
  "δρα",
  "κ",
  "κοσ",
  "κε",
  "κυριε",
  "κα",
  "κυριοσ",
  "κυρια",
  "πρ",
  "προεδροσ",
  "καθ",
  "καθηγητησ",
  "καθηγητη",
  "καθηγητρια",
  "διευθ",
  "διευθυντησ",
  "δοκτωρ",
  "δοκτορασ",
  "δοκτορα",
  // Latin
  "dr",
  "mr",
  "ms",
  "mrs",
  "prof",
]);

// Strip a leading honorific token (with optional trailing dot) from an already-trimmed,
// whitespace-collapsed string. Returns the original if stripping would leave nothing.
function stripHonorific(s: string): string {
  const tokens = s.split(/\s+/);
  if (tokens.length < 2) return s; // single token — no name left after stripping, keep as-is
  const firstKey = toKey(tokens[0].replace(/\.$/u, ""));
  return HONORIFICS.has(firstKey) ? tokens.slice(1).join(" ") : s;
}

export function normalizePersonName(raw: string): NormalizedName {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const display = stripHonorific(trimmed);
  return { display, key: toKey(display) };
}
