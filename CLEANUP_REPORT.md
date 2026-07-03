# VoiceNote Cleanup Audit — Phase 1 Report

Audit only. No files were edited. All findings below are file path + one-line
rationale, grouped per the requested sections.

---

## Phase 0 — Preflight (PASS)

- `npx jest`: **10 suites / 76 tests, all passing.**
- Honorific stripping work is complete:
  - Full-word Greek honorifics (δόκτωρ, καθηγητής/καθηγήτρια, κύριος/κυρία, διευθυντής, πρόεδρος, etc.) are in the `HONORIFICS` set in [src/normalizeName.ts](src/normalizeName.ts).
  - Word-boundary guard is real: `stripHonorific` only strips when the **entire first token** (post-dot-strip) matches a set entry — a prefix like "Δοκτωρ-" embedded in a longer surname does not match.
  - Negative case is tested: `__tests__/normalizeName.test.ts` includes `"Δοκτωρίδης"` (surname starting with δοκτωρ-) asserting it is **not** stripped, both alone and as the first of two tokens.
  - Re-backfill migration entry exists: [src/db.js:35-58](src/db.js#L35-L58) — a `user_version < 1` migration step nulls `people_normalized_json` and re-runs `backfill()` over every note.
  - Continuing to Phase 1 per the gate condition.

---

## 1. Readability

**Files over ~200 lines** (none egregious, but listed per instruction):
- [src/db.js](src/db.js) — 453 lines — all persistence logic in one file, per AGENTS.md design (single data layer); not a violation, but the largest file in the repo.
- [src/screens/NoteDetailScreen.tsx](src/screens/NoteDetailScreen.tsx) — 347 lines — view + edit + regenerate + delete flows all in one screen.
- [src/screens/RecordScreen.tsx](src/screens/RecordScreen.tsx) — 297 lines.
- [src/components/NoteEditForm.tsx](src/components/NoteEditForm.tsx) — 281 lines.
- [src/screens/NotesListScreen.tsx](src/screens/NotesListScreen.tsx) — 256 lines (inflated by the dev-only `devDumpDb` block, see §2).
- [src/screens/ChatScreen.tsx](src/screens/ChatScreen.tsx) — 244 lines.
- [src/services/agent.ts](src/services/agent.ts) — 231 lines — 6 tool definitions + dispatch loop in one file; reasonable given it's one cohesive tool-use loop.

**Layering violations (real bugs, not style):**
- [src/screens/NotesListScreen.tsx:11,50](src/screens/NotesListScreen.tsx#L11) — `import * as SQLite from "expo-sqlite"` and `SQLite.openDatabaseAsync(...)` **directly in a screen**, completely bypassing `db.js`/`notesRepository`. This is the `devDumpDb` dev-only debug dump (marked `// DEV ONLY — remove before shipping` at line 47, still shipped). Fixing this is the same action as the dead-code removal in §2 — delete the function and its UI button, which also resolves the layering violation.
- [src/screens/NoteDetailScreen.tsx:15,104](src/screens/NoteDetailScreen.tsx#L15) — `import { extractNote } from "../services/extraction"` and a direct call to it from `handleRegenerate`. AGENTS.md is explicit: "hooks are the ONLY place React state touches the pipeline... screens hold only view-level state — anything touching the pipeline belongs in a hook." This re-extraction flow should live in a hook (e.g. extend `usePipelineRun` or add a small `useRegenerateNote` hook) instead of the screen calling the service and doing its own try/catch/Alert.

**Comment gap — the one thing this audit was specifically asked to verify:**
- The `people_normalized_json` LIKE-match fragility (an object literal must serialize with `"key"` as the **first** JSON field for the `LIKE '%"key":"..."%'` pattern to match) is documented at the **read site** — [src/db.js:374-375](src/db.js#L374-L375) — but **not** at the **write site** — [src/db.js:110](src/db.js#L110), `seen.set(key, { key, display })` inside `normalizeAndDedupeNames`. A future refactor that reorders those object fields (e.g. alphabetizes them, or destructures differently) would silently break search with no compiler error and no comment warning the author at the point of the change. Needs a one-line comment at line 110 pointing at the read-site dependency.

**Naming inconsistency:**
- [src/hooks/useRecorder.ts:30](src/hooks/useRecorder.ts#L30) — `Alert.alert("Permission needed", "Microphone access denied.")` is in **English**; every other user-facing string in the app (all other `Alert.alert` calls, all UI copy) is in **Greek**. One-line fix, flagged here for the wording pass.

**One-off "clever" abstractions:** none found that rise to the level of "a newcomer would call this clever rather than clear." The codebase is generally direct — no premature abstraction spotted beyond what's flagged elsewhere.

---

## 2. Dead code

- [src/db.js:281](src/db.js#L281) — `getOpenActionItems` is exported but **never imported anywhere**, not even by `notesRepository.ts` (which imports 14 other `db.js` functions). Superseded by `getActionItemsFiltered`. Safe to delete.
- [src/hooks/usePipelineRun.ts:7](src/hooks/usePipelineRun.ts#L7) — `PipelinePhase` type is exported but only ever used within the same file. Drop the `export`.
- [src/types/agent.ts:10](src/types/agent.ts#L10) — `AgentActionItem` type is defined but never imported anywhere. Delete or confirm it's a documentation stub.
- [scripts/test-extraction.js](scripts/test-extraction.js) — a standalone manual script, not wired into `npm test`/Jest and not referenced by any `package.json` script. Orphaned dev tool; also uses stale medical fixture data (see §7).
- [src/screens/NotesListScreen.tsx:47-90ish](src/screens/NotesListScreen.tsx#L47) — `devDumpDb` function + its rendered `<Pressable>` button, explicitly commented `// DEV ONLY — remove before shipping`, still present and shipping to users. Also the layering violation from §1. Recommend full removal.
- [src/types/note.ts:19](src/types/note.ts#L19) / `decisions_json` column in db.js — `decisions` is never populated by the current extraction prompt (no `decisions` field in the prompt's SCHEMA block at all), so every new note saves `decisions: []`. `NoteCard.tsx` still conditionally renders it. Not fully dead (old notes may have data, comment says "kept for old notes") but a slowly-dying field — flagged here, decision on whether to keep deferred to the schema question in §7.
- `package.json` scripts: all five (`start`, `android`, `ios`, `web`, `test`) are valid and used; no dead entries.
- No unreachable branches, no commented-out code blocks, and no abandoned-experiment files (no `*-old`/`*-copy`/`*.bak`) found beyond the above.
- All SQL columns/tables in `db.js` (including every `ALTER TABLE` migration column) are read/written somewhere in `src/` — no dead schema.

---

## 3. Test coverage

Ran `npx jest --coverage`. Per-function status:

| File | Function | Status |
|---|---|---|
| db.js | `initDb` | UNCOVERED |
| db.js | `parseDueDate` | COVERED |
| db.js | `normalizeAndDedupeNames` | COVERED |
| db.js | `saveNote` | PARTIAL — notes-row insert + people normalization tested; action_items insert loop (due-date parsing, `all_day`/`due_time`) never exercised, all fixtures use `action_items: []` |
| db.js | `updateNote` | **UNCOVERED** — see bug below |
| db.js | `deleteNote` | UNCOVERED |
| db.js | `completeActionItem` / `reopenActionItem` / `deleteActionItem` | UNCOVERED |
| db.js | `setActionCalendarEvent` | UNCOVERED |
| db.js | `getNote` / `getRecentNotes` / `searchNotes` | UNCOVERED |
| db.js | `getOpenActionItems` | UNCOVERED (also dead, §2) |
| db.js | `getActionItemsFiltered` / `getNotesByDateRange` / `getRecentNotesByDays` | UNCOVERED |
| db.js | `getNotesByTag` | PARTIAL — person-tag branch covered; product/company branch untested |
| db.js | `backfill` | COVERED — incl. idempotency/no-op re-run |
| db.js | `hydrateNote` | COVERED — incl. null-column handling |
| normalizeName.ts | `normalizePersonName` | COVERED — extensive |
| types/note.ts | `copyNote` | COVERED |
| lib/dateAnchor.ts, dateFormat.ts | all | COVERED |
| services/*.ts | ALL exports (agent, authService, calendar, extraction, notesRepository, openaiClient, transcription) | **UNCOVERED** — no test imports anything from `src/services/` |
| hooks/*.ts | ALL exports (useAgentChat, useAppLock, useAuth, useCalendarToggle, usePipelineRun, useRecorder, useTasks) | **UNCOVERED** — no test imports anything from `src/hooks/` |

**Priority gaps:**
- **P1 (data integrity):** `updateNote` (see bug below), `getNote`, `deleteNote`, `completeActionItem`/`reopenActionItem`/`deleteActionItem`, `setActionCalendarEvent`, `getOpenActionItems`/`getActionItemsFiltered` date-boundary filtering, `saveNote`'s action-item insert branch.
- **P2 (extraction/parsing):** `extractNote` entirely untested (no coverage of prompt-output parsing/shape validation), `transcription.ts`/`openaiClient.ts` untested, `getNotesByTag` product/company branch.
- **P3 (everything else):** all hooks, `calendar.ts`, `authService.ts`, `agent.ts`, `notesRepository.ts` (thin wrapper, lower risk), remaining read queries.

**Known `updateNote` bug — CONFIRMED, not just suspected:**
[src/db.js:172-204](src/db.js#L172-L204) — `updateNote` deletes **all** `action_items` rows for the note and re-inserts fresh rows from `note.action_items`, each hard-coded to `status: 'open'` with no `calendar_event_id` in the INSERT (defaults `NULL`). Any action item that was previously `status='done'` or had a `calendar_event_id` set via `setActionCalendarEvent` **loses both** the moment its parent note is updated — it also gets a new `id`, orphaning any external reference (e.g. a calendar reminder keyed by the old id).
No test currently exercises `updateNote` at all. Proposed test (documented here, not yet written): using the same fake-`expo-sqlite` mock pattern as `personTagEndToEnd.test.js`, seed a note with one action item `status='done', calendar_event_id='cal-123'`; call `updateNote` with an edit that round-trips the same item's text/due_date (simulating the edit-form save path) but no status/calendar fields; then `getNote` and assert `status` is still `'done'` and `calendar_event_id` still `'cal-123'`. Expected to **currently fail**, proving the wipe.

---

## 4. Prompts

Locations: extraction prompt = [src/config/prompts.ts:1-73](src/config/prompts.ts#L1-L73) (`PROMPT_TEMPLATE`); agent system prompt = [src/config/prompts.ts:82-96](src/config/prompts.ts#L82-L96) (`AGENT_PROMPT_TEMPLATE`) + tools in [src/services/agent.ts:11-111](src/services/agent.ts#L11-L111); transcription has **no textual prompt at all** — [src/services/transcription.ts](src/services/transcription.ts) sends only `model` + `language: "el"`.

**Schema mismatch (severe — this is the big one):** the AGENTS.md-documented schema is `{ summary, people, topics, decisions, action_items:[{text, due_date}] }`. The live extraction prompt and [src/services/extraction.ts](src/services/extraction.ts) instead produce `{ summary, actions:[{title, date_reasoning, due_date, due_time, all_day, add_to_calendar}], people, products, companies }` — no `topics` field anywhere (uses `products`/`companies` instead, the exact fields AGENTS.md says are banned), no `decisions` field, and `action_items` is called `actions` with `title` instead of `text` plus three extra undocumented fields. `src/types/note.ts` and `src/types/agent.ts` mirror this same stale shape, so prompt and code are internally consistent with each other — just both out of date vs. AGENTS.md. **This is a schema-level question, not a wording fix** — see §7.

**Stale medical/pharma framing in the prompt itself:**
- [prompts.ts:1](src/config/prompts.ts#L1) — "You extract structured data from a Greek voice note for a **medical/pharma sales rep**."
- [prompts.ts:64](src/config/prompts.ts#L64) — `products: normalize phonetic Greek to the canonical brand ("λίρικα"→"Lyrica", "Ζαρέλτο"→"Xarelto")` — pharma-brand-specific instruction.
- [prompts.ts:68-72](src/config/prompts.ts#L68-L72) — all three worked examples use "δόκτωρ"/"καθηγήτρια" framing.

**Agent prompt vs. actual tools:** [prompts.ts:83](src/config/prompts.ts#L83) says "You have tools to search notes, retrieve note details, and query action items" — names only 3 of the **6** actual registered tools in `agent.ts` (`search_notes`, `get_note`, `get_action_items`, plus `get_notes_by_tag`, `get_notes_by_date_range`, `get_recent_notes` are never mentioned though the model has access). Also `get_notes_by_tag`'s `tag_type` enum (`'person'|'product'|'company'`, [agent.ts:75](src/services/agent.ts#L75)) uses the stale `product`/`company` vocabulary.

**Redundancy:** [prompts.ts:52-63](src/config/prompts.ts#L52-L63) — the people-tag stripping rule is restated three times nearly verbatim, then three worked examples all demonstrate the identical pattern. Could trim to one rule + one example.

No internal contradictions found within a single prompt.

---

## 5. AGENTS.md / CLAUDE.md drift

The documented file tree and roadmap describe an earlier, smaller version of this app. Actual code has grown well past it, and in some places directly contradicts current claims:

**Missing from the documented file tree entirely** (real files/features never mentioned):
- Auth: [src/services/authService.ts](src/services/authService.ts), [src/hooks/useAuth.ts](src/hooks/useAuth.ts), [src/screens/AuthScreen.tsx](src/screens/AuthScreen.tsx), [src/lib/supabase.ts](src/lib/supabase.ts), [src/config/supabase.ts](src/config/supabase.ts).
- App-lock: [src/hooks/useAppLock.ts](src/hooks/useAppLock.ts), [src/screens/LockScreen.tsx](src/screens/LockScreen.tsx) (expo-local-authentication + expo-secure-store).
- Tasks feature: [src/screens/TasksScreen.tsx](src/screens/TasksScreen.tsx), [src/hooks/useTasks.ts](src/hooks/useTasks.ts), [src/components/TaskRow.tsx](src/components/TaskRow.tsx), [src/components/TaskFilterBar.tsx](src/components/TaskFilterBar.tsx), [src/components/TasksEmptyState.tsx](src/components/TasksEmptyState.tsx), [src/types/tasks.ts](src/types/tasks.ts).
- Agent Q&A (roadmap item 4): [src/services/agent.ts](src/services/agent.ts), [src/hooks/useAgentChat.ts](src/hooks/useAgentChat.ts), [src/screens/ChatScreen.tsx](src/screens/ChatScreen.tsx), [src/types/agent.ts](src/types/agent.ts) — **already built**, roadmap still shows it as unstarted.
- Calendar reminders (roadmap item 3): [src/services/calendar.ts](src/services/calendar.ts), [src/hooks/useCalendarToggle.ts](src/hooks/useCalendarToggle.ts) — **already built**, roadmap still shows it as unstarted.
- [src/normalizeName.ts](src/normalizeName.ts) itself and [src/lib/dateAnchor.ts](src/lib/dateAnchor.ts) aren't in the tree at all.

**Named-but-wrong:**
- AGENTS.md's `/lib` example lists `id.ts` — this file **does not exist**.
- AGENTS.md's `/hooks` example says `useNotes` — no such hook exists (it's `useTasks`, `usePipelineRun`, etc.).
- AGENTS.md's `/types` note says "note.ts — single source of truth" — `types/agent.ts` and `types/tasks.ts` also exist and are undocumented.

**Factually false claim (the big one):** AGENTS.md states "OpenAI key is in .env as `EXPO_PUBLIC_OPENAI_API_KEY`" and "the OpenAI key... lives on-device until then [step 5]." Neither is true anymore — [src/services/openaiClient.ts](src/services/openaiClient.ts) routes every OpenAI call through a **Supabase Edge Function proxy** (`https://ccebaccebrzcvhgcypvz.supabase.co/functions/v1/openai-proxy`), authenticated via Supabase session token. No `EXPO_PUBLIC_OPENAI_API_KEY` reference exists anywhere in the repo. Roadmap step 5 ("thin backend proxy for the OpenAI key") is **already done**, not future work.

**Undocumented but real conventions** (exist in code, never written down):
- The `people_normalized_json` B-prime schema (`{key, display}`, key-first-field LIKE-match dependency, §1).
- The backfill trigger mechanism (`user_version` migration gate in `db.js`).
- The layering rule is accurate to the code *except* the two violations in §1.

**Roadmap checkboxes are stale:** only item 1 is marked ✅, but items 2 (notes list UI), 3 (calendar reminders), and 4 (agent Q&A) are all clearly implemented in the current tree.

**Extraction schema section is aspirational, not descriptive:** the documented `{summary, people, topics, decisions, action_items:[{text,due_date}]}` schema does not match what the code actually produces (§4). This is the single largest AGENTS.md/reality gap in the repo.

---

## 6. Hygiene

- **`any` usage: 3 occurrences total** — very clean. `catch (e: any)` in [usePipelineRun.ts:41](src/hooks/usePipelineRun.ts#L41) and [NoteDetailScreen.tsx:110](src/screens/NoteDetailScreen.tsx#L110); one `as any` in [transcription.ts:6](src/services/transcription.ts#L6) for a React Native `FormData` file-part type gap (likely a legitimate/necessary cast given RN's FormData typings).
- **`@ts-ignore` / `@ts-expect-error`: zero occurrences.**
- **Error handling — three patterns currently coexist:**
  1. Hook-level `{data, loading, error}` state with the error message stored and read by the screen (`useTasks`, `useAgentChat`, `usePipelineRun`) — matches AGENTS.md's documented hook contract.
  2. Silent `catch {}` with an inline comment justifying why swallowing is safe (`calendar.ts` `ensurePermission`/`removeReminder` — "already deleted or not found"; `useTasks.remove` — "Alert already shown by TaskRow, avoid double-alerting"). This is a deliberate, documented pattern, not sloppiness.
  3. Direct `Alert.alert` from screens/hooks for confirmations and one-off errors (`NoteDetailScreen.handleRegenerate`, `useRecorder` permission denial, `NotesListScreen` dev-dump errors).
  **Proposed single convention:** hooks always expose `{data, loading, error}` and never call `Alert` themselves; screens read `error` and decide whether/how to surface it (Alert vs inline text); a silent catch is only acceptable with a comment stating why the failure is expected/safe to ignore (already the norm — just needs to be the *only* pattern, meaning `NoteDetailScreen`'s direct try/catch/Alert around `extractNote` moves into a hook, which also fixes the §1 layering violation).
- `package.json` scripts: all 5 valid, none dead or broken.
- Locale inconsistency (English string in an all-Greek UI): [useRecorder.ts:30](src/hooks/useRecorder.ts#L30) — flagged in §1, relevant here too.

---

## 7. Pivot sweep (medical-sales → personal assistant)

No `README.md` and no `evals/`/`fixtures/` directory exist in the repo currently.

**Pure WORDING fixes (safe to reword, no schema impact):**
- [src/config/prompts.ts:1](src/config/prompts.ts#L1) — "...for a medical/pharma sales rep."
- [src/config/prompts.ts:64-65](src/config/prompts.ts#L64-L65) — pharma-brand normalization examples ("λίρικα"→Lyrica, Ζαρέλτο→Xarelto); "clinics" in the companies-tag description.
- [src/config/prompts.ts:68-72](src/config/prompts.ts#L68-L72) — worked examples using δόκτωρ/καθηγήτρια and "στείλουμε δείγματα" (pharma-rep sample-delivery language).
- [app.json:28](app.json#L28) — `microphonePermission: "Allow VoiceNote to access your microphone to record visit notes."` — "visit notes" is doctor-visit/sales-call terminology, and it's user-facing (iOS/Android permission dialog).
- [src/config/theme.ts:7,24](src/config/theme.ts#L7) — comments describing colors as "clinical" (aesthetic descriptor only, no logic impact).
- [scripts/test-extraction.js](scripts/test-extraction.js) — fixture strings like `'Επικοινωνία με τον Δρ. Παπαδόπουλο'` and `'Τηλεφώνημα με πελάτη'` ("client" in a sales sense).
- Various `__tests__/*` fixtures using Δρ./δόκτωρ Παπαδόπουλος as sample names — fine generically (they test honorific-stripping logic, not medical framing) but cosmetically medical-flavored; low priority.

**SCHEMA decisions — flagging only, NOT deciding:**
1. **The `products` field.** It's a first-class citizen across the entire pipeline: [types/note.ts](src/types/note.ts) (`Note.products`), [types/agent.ts](src/types/agent.ts), [extraction.ts](src/services/extraction.ts) (`ExtractedNote.products`), [db.js](src/db.js) (mapped to a `topics_json` column — comment says "edit form writes topics → stored as products"), [agent.ts](src/services/agent.ts) tool `tag_type` enum `'person'|'product'|'company'`, and rendered in UI ([Tag.tsx](src/components/Tag.tsx) `variant="product"`, [NoteCard.tsx](src/components/NoteCard.tsx), [NoteEditForm.tsx](src/components/NoteEditForm.tsx)). AGENTS.md already asserts "topics covers everything that was products in the old medical schema" but the code never finished that migration — extraction still emits `products`/`companies`, not `topics`. **Options to choose between:** (a) finish the migration — extraction emits a single `topics` array, drop `products`/`companies`/`title`/`actions` naming everywhere; (b) keep three distinct tag types (person/product/company) as intentional and update AGENTS.md to describe that reality instead of the aspirational one; (c) some hybrid (e.g. merge `companies` into `topics`, keep `products` separate, or vice versa).
2. **The `decisions` field.** Never populated by the current prompt at all (§2, §4). Decide: keep it in the schema for the personal-assistant context (e.g. "decided to book the flight") and add prompt support, or drop it entirely.
3. **`action_items` shape.** Current real shape is `{title, date_reasoning, due_date, due_time, all_day, add_to_calendar}`; AGENTS.md documents a simpler `{text, due_date}`. Decide whether to keep the richer shape (useful for the existing calendar-reminder feature, which relies on `due_time`/`all_day`) and correct AGENTS.md to match, or trim the schema back to the documented minimal shape and lose calendar-reminder precision.

These three are linked — resolving #1 likely also resolves the `title`-vs-`text` and `actions`-vs-`action_items` naming (§4), so they should be decided together, not one at a time.

---

## Proposed Phase 2 execution order

Small, independently verifiable increments, full test suite run after each:

1. **Dead code removal** (no behavior change): delete `getOpenActionItems` (db.js), un-export `PipelinePhase`, delete `AgentActionItem` if truly unused, delete `scripts/test-extraction.js`, delete `devDumpDb` + its UI button in `NotesListScreen.tsx` (this also resolves the SQLite layering violation in one shot).
2. **Layering fix**: move `NoteDetailScreen`'s direct `extractNote` call into a hook (extends the "hooks own the pipeline" rule + fixes the error-handling convention in one increment, since both point at the same code).
3. **Comment fix**: add the write-site comment at `db.js:110` documenting the LIKE-match key-order dependency.
4. **Wording-only pivot sweep**: reword `prompts.ts` (drop medical/pharma framing, swap pharma-brand examples for generic ones, keep the rule structure), `app.json` permission string, `theme.ts` comments, test/script fixture names. Explicitly deferring the `products`/`decisions`/`action_items` schema questions (§7) until you decide.
5. **Test additions**, P1 first: `updateNote` regression test (proving the status/calendar_event_id wipe) is highest priority since it's a confirmed real bug, then `getNote`/`deleteNote`/`completeActionItem` etc., then P2 (`extractNote`).
6. **Naming/locale fix**: translate the one English Alert string in `useRecorder.ts` to Greek.
7. **AGENTS.md rewrite**: correct file tree, roadmap checkboxes, OpenAI-proxy-is-already-done fact, B-prime schema + backfill + LIKE-pattern documentation. This waits until after the schema decision (§7) so the rewritten extraction-schema section describes the *post-decision* reality, not another soon-to-be-stale snapshot.
8. **README.md** — last, once the schema question is settled and AGENTS.md is corrected, so the README describes accurate current architecture rather than something that'll need re-writing again.

**Before step 4/7 can fully complete, I need your decision on the three schema questions in §7** (products vs. topics, decisions field, action_items shape) — everything else can proceed without waiting on that.

Stopping here for your review and approval before touching any code.
