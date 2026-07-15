# Hey Lisa — personal voice-note assistant

## What this is

An Expo (SDK 54) React Native + TypeScript mobile app. A **personal assistant for a
person's own life** — appointments, errands, people, reminders, ideas — not a
business or team tool. A user speaks → the app transcribes → extracts a structured
note → saves it locally → surfaces open to-dos → answers questions about notes via
an agent chat.

Pipeline: record (expo-audio) → transcribe (OpenAI `gpt-4o-transcribe`, Greek) →
extract structured note (`gpt-4o-mini`, JSON) → `saveNote()` → render note card.
All OpenAI calls go through a Supabase Edge Function proxy (`src/services/openaiClient.ts`),
authenticated with the user's Supabase session token — the OpenAI key is never on-device.

## Design philosophy (do NOT violate)

- PERSONAL-UTILITY-FIRST. Features serve the individual user. NO manager dashboards,
  NO team views, NO analytics, NO "you are being watched" surfaces.
- The hook is follow-up capture: "what did I say I'd do." Keep action_items central.
- Don't guess data. Empty fields are fine; wrong fields destroy user trust.
- Notes and all app data live on-device (expo-sqlite via `src/db/`) — there is no
  server-side data store and no cloud sync of notes. Auth (Supabase) and the OpenAI
  proxy exist solely to keep the OpenAI API key off-device; they are not a general
  backend, and no note data is ever sent to or stored on the proxy.

## Stack

- Expo SDK 54 — PINNED for Expo Go compatibility. Do not bump it.
- React Native, single codebase iOS + Android.
- `@react-navigation` (native-stack + bottom-tabs) for navigation.
- expo-audio (NOT the deprecated expo-av).
- expo-sqlite ~16.x — async API. All DB access goes through `src/db/`.
- expo-calendar — device calendar reminders for action items.
- expo-notifications — local push reminders for action items (see Notifications below).
- expo-local-authentication + expo-secure-store — app-lock (biometric/PIN gate).
- `@supabase/supabase-js` — auth session + the OpenAI proxy's auth token. No note
  data is stored in Supabase; it is not a second data layer.
- OpenAI: `gpt-4o-transcribe` (STT), `gpt-4o-mini` (extraction + agent).

## Extraction schema (exact — what the LLM returns; see `src/config/prompts.ts`)

```json
{
  "summary": "string",
  "actions": [
    {
      "title": "string",
      "date_reasoning": "string",
      "due_date": "YYYY-MM-DD or null",
      "due_time": "HH:MM 24h or null",
      "all_day": true,
      "add_to_calendar": true
    }
  ],
  "people": ["string"],
  "topics": ["string"]
}
```

`src/services/extraction.ts` maps this onto the app-level `Note`/`ActionItem` types
(`types/note.ts`): `actions[].title` → `ActionItem.text`, `due_date`/`due_time`/`all_day`
pass through as-is. `ActionItem` additionally carries `status` and `calendar_event_id`,
which are app-managed (never produced by the LLM).

`topics` is a single general-purpose tag for subjects, things, or organizations
mentioned — it replaced an earlier `products`/`companies` split left over from a
medical-sales-rep version of this app. Never reintroduce a domain-specific tag field.

`decisions` exists on the stored `Note` type (kept so old notes still round-trip) but
is **not** produced by the current prompt and has no UI. Do not build prompt/UI support
for it unless a future task explicitly asks — it was evaluated and intentionally
dropped as unneeded for the personal-assistant use case.

## Persistence — `src/db/` (single data layer, split by responsibility)

Import ONLY via `"../db"` (the barrel, `db/index.js`) — never reach into a submodule
directly. `src/services/notesRepository.ts` is a thin async wrapper around that
barrel; do not add a second data layer.

- `connection.js` — schema (`notes`, `action_items`, `notes_fts`), `migrate()`,
  `backfill()`, `getDb()` / `initDb()`.
- `shared.js` — pure helpers: `parseDueDate`, `normalizeAndDedupeNames`, `stemKey`,
  `canonicalizeTopics`, `hydrateNote`.
- `fts.js` — `searchNotes`, `searchNotesInRange` (FTS5 query build + execute).
- `notesRead.js` — `getNote`, `getRecentNotes`, `getNotesByDateRange`,
  `getNotesByTag`, `getRecentNotesByDays`.
- `notesWrite.js` — `saveNote`, `updateNote`, `deleteNote` — also responsible for
  keeping `notes_fts` in sync on every write.
- `actionItems.js` — `completeActionItem`, `setActionCalendarEvent`,
  `setActionNotificationId`, `reopenActionItem`, `deleteActionItem`.
- `agentQueries.js` — `getActionItemsFiltered`, `getTasksWithDueDates`.
- `index.js` — barrel re-export; the only import path other code should use.

### Search is THREE mechanisms — do not conflate them

1. **Keyword search** (`searchNotes` / `searchNotesInRange`, backing the agent's
   `search_notes` / `search_notes_in_range` tools) — FTS5, external-content table
   `notes_fts` over `toKey()`-normalized transcript/summary text (accent-stripped,
   lowercase, final-sigma folded), `tokenize='unicode61'`. Query building
   (`buildFtsQuery` in `db/fts.js`) turns each word into a `stemGreekTerm`-based
   prefix token, dropping `GREEK_STOPWORDS` so articles/prepositions don't force a
   mandatory AND. Because `notes_fts` is external-content, it is **not** kept in
   sync automatically — every write path in `notesWrite.js` must explicitly
   delete+insert the FTS row alongside the base-table write.
2. **Topic tag lookup** (`getNotesByTag('topic', value)`) — no SQL LIKE/FTS
   involved. Fetches candidate notes, then matches in JS via `stemKey`
   (`db/shared.js`): every stemmed word of the query must be a subset of the
   stemmed word set of a stored topic tag.
3. **Person tag lookup** (`getNotesByTag('person', value)`) — raw SQL
   `LIKE '%"key":"<value-key>"%'` against `people_normalized_json`. Depends on
   `key` serializing before `display` — see the field-order note below.

### The `people_normalized_json` schema and its LIKE-match dependency

Each note stores people twice: `people_json` (display strings, honorifics stripped)
and `people_normalized_json` — an array of `{key, display}` objects, where `key` is
the accent-free/lowercase/final-sigma-folded dedup key (`src/normalizeName.ts`) and
`display` is the cleaned name shown in the UI. The person-tag LIKE match above
**depends on `key` serializing as the first field of the object.** Both the write
site (`normalizeAndDedupeNames` in `db/shared.js`) and the read site
(`getNotesByTag` in `db/notesRead.js`) carry a comment noting this — do not reorder
those fields without checking both.

### Migration state

`db/connection.js`'s `migrate()` applies an idempotent `ALTER TABLE` list (safe to
re-run — "column already exists" errors are swallowed), then a series of one-time
rewrites gated behind SQLite's `user_version` PRAGMA. Current `user_version`: 5.

- `< 1` — re-derive `people_json` / `people_normalized_json` for every note.
- `< 2` — merge `companies_json` into `topics_json`, drop `companies_json`.
- `< 3` — backfill `notes_fts` for notes that predate the FTS5 table.
- `< 4` — drop and rebuild `notes_fts` with `toKey()`-normalized content.
- `< 5` — canonicalize each note's `topics_json` via `canonicalizeTopics`.

Follow this pattern for any future one-time repair: add the idempotent
`ALTER TABLE` (if needed) to the unconditional list, then gate the rewrite behind
the next `user_version`.

## Agent Q&A layer — `src/services/agent.ts`

Tool-use loop over `notesRepository`, seven tools:

- `search_notes(terms)` — FTS5 keyword search, ≤10 rows.
- `search_notes_in_range(terms, from, to)` — keyword search AND'd with a
  `created_at` range in one query, ≤50 rows; canonical tool whenever a question is
  BOTH date-scoped and keyword-scoped (don't split it into two tool calls).
- `get_note(id)` — full note including transcript and open action items.
- `get_action_items({status, due_before, due_after, overdue})` — ≤50 rows;
  `overdue:true` is resolved **in code**, against the Europe/Athens "today" from
  `buildAnchor()`, never computed by the model.
- `get_notes_by_tag(tag_type, value)` — person or topic, ≤20 rows.
- `get_notes_by_date_range(from, to)` — `created_at` range only, no keyword, ≤50 rows.
- `get_recent_notes(days)` — last N days (default 7), ≤50 rows.

These row caps are also spelled out in the agent's own system prompt so the model
can answer "at least N" instead of a false-exact count when a result set is capped.

`buildAnchor()` (`src/lib/dateAnchor.ts`) returns `{iso, weekday, calendarBlock}` and
is injected into **both** prompt templates — the extraction prompt
(`buildSystemPrompt`) and the agent prompt (`buildAgentSystemPrompt`), both in
`config/prompts.ts` — via `{{CALENDAR_BLOCK}}`. Update both call sites together if
the anchor shape ever changes.

Every tool call is traced via `console.log('[agent:tool]', name, args, ...)` gated
behind `__DEV__` (row count on success, error string on failure) — `__DEV__` only,
never a separate flag or `NODE_ENV` check.

## Notifications — `src/services/notifications.ts`

- `action_items.notification_id` stores the expo-notifications scheduled-notification
  id, parallel to `calendar_event_id`; set via `db/actionItems.js`'s
  `setActionNotificationId`.
- Permission gate — `ensurePermission()` / `getPermissionStatus()`; a denied or
  undetermined permission makes scheduling silently no-op, never throw.
- Fire-time selection — `computeFireTime(item)`: local 09:00 on `due_date` for an
  all-day item, or `due_time` minus `REMINDER_OFFSET_MINUTES` for a timed one;
  returns `null` (no schedule, no immediate-fire fallback) if that instant has
  already passed.
- Tap routing — a notification's `data.noteId` round-trips through `navigationRef`
  to open `NoteDetail`, for both a warm tap
  (`addNotificationResponseReceivedListener`) and a cold start
  (`handleInitialNotification`, called from `NavigationContainer`'s `onReady`).

**HOOKS-ONLY scheduling — a hard invariant, same weight as the layer rules below:**
`scheduleReminder` / `cancelReminder` are called only from hooks or screens
(`useNotificationSettings`, `useTasks`, `useTodayTasks`, `useNoteActionItems`,
`useRegenerateNote`, `usePipelineRun`, `NoteDetailScreen`, `NotesListScreen`) —
**never** from `db/` and never from a service acting alone. `db/` write paths that
remove or replace an action item return `ReminderIds` (`notification_id` +
`calendar_event_id`) so the *caller* can cancel the device-side reminder; `db/`
itself never imports `expo-notifications` or `expo-calendar`.

## Code structure

```
/src
  /screens    — RecordScreen, NotesListScreen, NoteDetailScreen, TasksScreen,
                ChatScreen, AuthScreen, LockScreen, SettingsScreen
  /hooks      — useRecorder, usePipelineRun, useRegenerateNote, useCalendarToggle,
                useCalendarSettings, useTasks, useTodayTasks, useNoteActionItems,
                useNotificationSettings, useAgentChat, useAuth, useAppLock
  /components — NoteCard, FollowUpRow, Tag, NoteEditForm, TaskRow, TaskFilterBar,
                TasksEmptyState, TodaySection, Snackbar
  /services   — transcription.ts, extraction.ts, agent.ts (tool-use loop),
                calendar.ts, calendarPrefs.ts, notifications.ts, taskBuckets.ts,
                authService.ts, openaiClient.ts (Supabase proxy client),
                notesRepository.ts (db/ wrapper)
  /types      — note.ts (Note, ActionItem, ReminderIds, UpdateNoteDiff), agent.ts,
                tasks.ts, calendar.ts, navigation.ts
  /lib        — dateFormat.ts, dateAnchor.ts, textNormalize.ts (toKey),
                greekStem.ts (stemGreekTerm), navigationRef.ts, supabase.ts (client init)
  /config     — theme.ts, models.ts, prompts.ts, notifications.ts,
                supabase.ts (project URL/anon key)
  normalizeName.ts — honorific stripping + name dedup key (used by db/shared.js,
                     db/notesRead.js)
  /db         — expo-sqlite persistence, split by responsibility (see Persistence
                above); import ONLY via "../db"
```

- One responsibility per file.
- Swap STT provider by editing `services/transcription.ts` only.
- Swap storage backend by editing `services/notesRepository.ts` + `db/` only.
- No premature abstractions. Justify anything beyond React state/context.
- Log convention: `console.error('[module:function] message', err)` — tag every
  caught error with its source so it's traceable from a device log.

### Layer dependency rule (this is what keeps it clean)

Imports point in ONE direction: downward. A file may import from layers below it,
NEVER from a layer above. Layers, top to bottom:

```
  screens
  hooks             components
  services
  lib
  config   types   db/     ← foundation, import nothing upward
```

Hard invariants — a violation is a BUG, not a style choice:

- `components` NEVER import a service, hook, db/, or call fetch/OpenAI. Data comes
  in via props; events go out via callbacks. They may use `config` (theme), `types`,
  and `lib` (formatting) only.
- `hooks` are the ONLY place React state (`useState`/`useEffect`) touches the
  pipeline. They wrap services and expose `{ data, loading, error }` to screens.
  They import `services`, `types`, `config` — NEVER a component or screen.
- `services` NEVER import a hook, component, or screen. They orchestrate lib + db/
  and return typed results, framework-agnostic.
- `config` / `types` / `db/` import nothing else from /src (`db/` may use types).
- `screens` wire hooks to components. They hold only view-level state (which tab,
  modal open) — anything touching the pipeline belongs in a hook.
- Device-reminder scheduling (`scheduleReminder`/`cancelReminder`,
  `expo-calendar` equivalents) is HOOKS-ONLY — see Notifications above.

If you spot a violation, fix it; don't preserve it.

## Adding a feature (build bottom-up)

Build the foundation first and the UI last. Each step is small enough to review on
its own and ends with a way to verify on-device.

1. `types` — define the shapes / contract first.
2. `config` — add any prompt to `prompts.ts` and pin the model name in `models.ts`.
   No magic strings anywhere else.
3. `db/` — add or extend persistence functions in the relevant submodule if the
   feature stores data.
4. `services` — write the logic. Pure and verifiable with a script BEFORE any UI exists.
5. `hooks` — wrap the service in state (`{ data, loading, error }`).
6. `components` — presentational pieces, fed entirely by props.
7. `screens` — wire the hook to the components.

Example of this in practice: agent Q&A was built as `types/agent.ts` (tool/message
shapes) → `prompts.ts` (agent system prompt) → `services/agent.ts` (tool-use loop
over `notesRepository` methods) → `useAgentChat` hook → `ChatScreen`.

Definition of done — every feature checks:

- [ ] Serves the individual user (no manager / team / analytics surface).
- [ ] Every new file lives in ONE layer, with no upward imports.
- [ ] Types end-to-end, no `any` in the pipeline.
- [ ] Reuses the existing error-handling pattern — doesn't invent a new one.
- [ ] Test suite (`npm test`) is green.
- [ ] No dead code or leftover scaffolding from the attempt.

## Testing

Tests live in root-level `__tests__/` (not under `src/`), named after the module or
behavior under test. `npm test` runs `jest` via the `jest-expo` preset. A one-time
data-repair migration gate gets its own isolated test (open a DB at a lower
`user_version`, run `migrate()`, assert the rewrite) rather than being exercised
only incidentally through other tests. The suite must be green before a feature
is done.

## Roadmap

Built: persistence + schema generalisation, notes list + open to-dos UI, calendar
reminders (`expo-calendar`), local push reminders (`expo-notifications`) with
notification-tap routing to `NoteDetail`, agent Q&A (tool-use loop over notes/action
items), Supabase auth + app-lock, and the OpenAI proxy (key is off-device).

Known deferred:
- `NotesListScreen.test.tsx` (and other render-test files) fail `tsc --noEmit` —
  missing `@types/react-test-renderer` declarations; `npm test` itself is unaffected.
- `NoteDetailScreen`'s reminder-cleanup wiring (`saveEdit`/`handleDelete`) has no
  dedicated screen-level test; the underlying logic is covered via `useRegenerateNote.test.ts`.

## Rules — DO NOT

- Reintroduce a domain-specific tag field (e.g. a medical/sales "product" or
  "company" field) — general subjects/entities belong under `topics`.
- Add a `decisions` prompt/UI — it was evaluated and intentionally left unimplemented.
- Add vector DB (keyword search is enough at this scale).
- Break Expo Go compatibility (no custom dev-build-only libraries without flagging it first).
- Send note data (transcripts, summaries, tags) to Supabase or any other server —
  it stays on-device; Supabase is auth + an OpenAI-proxy relay only.
- Create a second data layer beside `db/`.

## Working agreement

- For any new feature: propose file structure + approach, then WAIT for approval
  before writing code.
- Find the EXISTING pattern for what you're doing and follow it. Do NOT introduce a
  new approach, library, or abstraction when one already exists. If nothing fits,
  say so and propose — don't improvise silently.
- Explain structural decisions briefly as you go.
