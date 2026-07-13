import { toKey } from "../lib/textNormalize";
import { getDb } from "./connection";
import { hydrateNote } from "./shared";

// Normalizes and quote-wraps each whitespace-separated term of a search query
// into an FTS5 MATCH expression (space-separated quoted phrases = implicit AND).
// Quoting each term neutralizes FTS5 query-syntax operators (-, *, OR, NEAR, …)
// that a spoken-language query might otherwise contain by accident; embedded
// double quotes are stripped since they'd otherwise break out of the phrase.
// Returns null if nothing usable remains (e.g. a query of only quote marks).
function buildFtsQuery(trimmedQuery) {
  const terms = toKey(trimmedQuery)
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ""))
    .filter((t) => t.length > 0);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"`).join(" ");
}

export async function searchNotes(query, limit = 10) {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];
  const ftsQuery = buildFtsQuery(trimmed);
  if (!ftsQuery) return [];

  const db = await getDb();
  try {
    const rows = await db.getAllAsync(
      `SELECT notes.*,
         (SELECT COUNT(*) FROM action_items a WHERE a.note_id = notes.id AND a.status = 'open') AS open_count
       FROM notes_fts
       JOIN notes ON notes.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
       ORDER BY notes_fts.rank
       LIMIT ?`,
      ftsQuery,
      limit,
    );
    return rows.map(hydrateNote);
  } catch (err) {
    // FTS5 unavailable, corrupt index, malformed MATCH expression, etc. — the
    // agent's search_notes tool must degrade to "no results", not crash the loop.
    console.error(`[db:searchNotes] FTS5 query failed for "${query}", returning no results`, err);
    return [];
  }
}
