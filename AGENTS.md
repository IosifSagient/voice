# VoiceNote — personal voice-note assistant

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
- Notes and all app data live on-device (expo-sqlite via `src/db.js`) — there is no
  server-side data store and no cloud sync of notes. Auth (Supabase) and the OpenAI
  proxy exist solely to keep the OpenAI API key off-device; they are not a general
  backend, and no note data is ever sent to or stored on the proxy.

## Stack

- Expo SDK 54 — PINNED for Expo Go compatibility. Do not bump it.
- React Native, single codebase iOS + Android.
- `@react-navigation` (native-stack + bottom-tabs) for navigation.
- expo-audio (NOT the deprecated expo-av).
- expo-sqlite ~16.x — async API. All DB access goes through `src/db.js`.
- expo-calendar — device calendar reminders for action items.
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

## Persistence — `src/db.js` (single data layer)

Representative public functions: `initDb()`, `saveNote(extraction, transcript)`,
`getNote(id)`, `updateNote(note)`, `deleteNote(id)`, `getRecentNotes(limit)`,
`searchNotes(query, limit)`, `getNotesByTag(tagType, value)`,
`getNotesByDateRange(from, to)`, `getRecentNotesByDays(days)`,
`getActionItemsFiltered({status, dueBefore, dueAfter})`, `completeActionItem(id)`,
`reopenActionItem(id)`, `deleteActionItem(id)`, `setActionCalendarEvent(id, eventId)`,
`backfill(db)` (one-time data-repair helper, also called from every migration path).

Use ONLY these. `src/services/notesRepository.ts` is a thin async wrapper
around them — do not add a second data layer.

### The `people_normalized_json` schema and its LIKE-match dependency

Each note stores people twice: `people_json` (display strings, honorifics stripped)
and `people_normalized_json` — an array of `{key, display}` objects, where `key` is
the accent-free/lowercase/final-sigma-folded dedup key (`src/normalizeName.ts`) and
`display` is the cleaned name shown in the UI.

`getNotesByTag('person', value)` matches people by doing a raw
`LIKE '%"key":"<value-key>"%'` against `people_normalized_json` rather than parsing
JSON in SQL. **This depends on `key` serializing as the first field of the object.**
Both the write site (`normalizeAndDedupeNames` in `db.js`) and the read site
(`getNotesByTag`) carry a comment noting this — do not reorder those fields without
checking both.

### Migration / backfill mechanism

`db.js` bumps SQLite's `user_version` PRAGMA once per one-time data repair (see
`migrate()`): `user_version < 1` re-derives `people_json`/`people_normalized_json`
for every existing note (the honorific-stripping policy change); `user_version < 2`
merged the old `companies_json` column into `topics_json` and dropped the column
(the products/companies → topics migration). Follow this pattern for any future
one-time repair: add an idempotent `ALTER TABLE` (if needed) to the unconditional
migrations list, then gate the one-time data rewrite behind the next `user_version`.

## Code structure

```
/src
  /screens    — RecordScreen, NotesListScreen, NoteDetailScreen, TasksScreen,
                ChatScreen, AuthScreen, LockScreen, SettingsScreen
  /hooks      — stateful logic that wraps services (useRecorder, usePipelineRun,
                useRegenerateNote, useCalendarToggle, useTasks, useAgentChat,
                useAuth, useAppLock)
  /components — NoteCard, FollowUpRow, Tag, NoteEditForm, TaskRow, TaskFilterBar,
                TasksEmptyState
  /services   — transcription.ts, extraction.ts, agent.ts (tool-use loop),
                calendar.ts, authService.ts, openaiClient.ts (Supabase proxy client),
                notesRepository.ts (db.js wrapper)
  /types      — note.ts (Note, ActionItem), agent.ts, tasks.ts
  /lib        — dateFormat.ts, dateAnchor.ts, supabase.ts (client init)
  /config     — theme.ts, models.ts, prompts.ts, supabase.ts (project URL/anon key)
  normalizeName.ts — honorific stripping + name dedup key (used by db.js)
  db.js       — expo-sqlite persistence (all DB logic lives here)
```

- One responsibility per file.
- Swap STT provider by editing `services/transcription.ts` only.
- Swap storage backend by editing `services/notesRepository.ts` + `db.js` only.
- No premature abstractions. Justify anything beyond React state/context.

### Layer dependency rule (this is what keeps it clean)

Imports point in ONE direction: downward. A file may import from layers below it,
NEVER from a layer above. Layers, top to bottom:

```
  screens
  hooks             components
  services
  lib
  config   types   db.js     ← foundation, import nothing upward
```

Hard invariants — a violation is a BUG, not a style choice:

- `components` NEVER import a service, hook, db.js, or call fetch/OpenAI. Data comes
  in via props; events go out via callbacks. They may use `config` (theme), `types`,
  and `lib` (formatting) only.
- `hooks` are the ONLY place React state (`useState`/`useEffect`) touches the
  pipeline. They wrap services and expose `{ data, loading, error }` to screens.
  They import `services`, `types`, `config` — NEVER a component or screen.
- `services` NEVER import a hook, component, or screen. They orchestrate lib + db.js
  and return typed results, framework-agnostic.
- `config` / `types` / `db.js` import nothing else from /src (db.js may use types).
- `screens` wire hooks to components. They hold only view-level state (which tab,
  modal open) — anything touching the pipeline belongs in a hook.

The old debt was exactly these violations — a component calling the API, extraction
logic pasted into a UI file. If you spot one, fix it; don't preserve it.

## Adding a feature (build bottom-up)

Build the foundation first and the UI last. Each step is small enough to review on
its own and ends with a way to verify on-device.

1. `types` — define the shapes / contract first.
2. `config` — add any prompt to `prompts.ts` and pin the model name in `models.ts`.
   No magic strings anywhere else.
3. `db.js` — add or extend persistence functions if the feature stores data.
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
- [ ] No dead code or leftover scaffolding from the attempt.

## Roadmap

Built: persistence + schema generalisation, notes list + open to-dos UI, calendar
reminders (`expo-calendar`), agent Q&A (tool-use loop over notes/action items),
Supabase auth + app-lock, and the OpenAI proxy (key is off-device). There is no
currently planned next roadmap item — propose one before starting speculative work.

## Rules — DO NOT

- Reintroduce a domain-specific tag field (e.g. a medical/sales "product" or
  "company" field) — general subjects/entities belong under `topics`.
- Add a `decisions` prompt/UI — it was evaluated and intentionally left unimplemented.
- Add vector DB (keyword search is enough at this scale).
- Break Expo Go compatibility (no custom dev-build-only libraries without flagging it first).
- Send note data (transcripts, summaries, tags) to Supabase or any other server —
  it stays on-device; Supabase is auth + an OpenAI-proxy relay only.
- Create a second data layer beside `db.js`.

## Working agreement

- For any new feature: propose file structure + approach, then WAIT for approval
  before writing code.
- Find the EXISTING pattern for what you're doing and follow it. Do NOT introduce a
  new approach, library, or abstraction when one already exists. If nothing fits,
  say so and propose — don't improvise silently.
- Explain structural decisions briefly as you go.
