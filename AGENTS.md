# VoiceNote — voice-note AI assistant

## What this is

An Expo (SDK 54) React Native + TypeScript mobile app, **general-purpose** across all
business departments. A user speaks → the app transcribes → extracts a structured
note → saves it locally → (roadmap) sends reminders and answers questions about notes.

Pipeline: record (expo-audio) → transcribe (OpenAI gpt-4o-transcribe, Greek) →
extract structured note (gpt-4o-mini, JSON) → saveNote() → render note card.
OpenAI key is in .env as `EXPO_PUBLIC_OPENAI_API_KEY`.

## Design philosophy (do NOT violate)

- PERSONAL-UTILITY-FIRST. Features serve the individual user. NO manager dashboards,
  NO team views, NO analytics, NO "you are being watched" surfaces.
- The hook is follow-up capture: "what did I say I'd do." Keep action_items central.
- Don't guess data. Empty fields are fine; wrong fields destroy user trust.
- LOCAL-FIRST. On-device storage only (expo-sqlite via src/db.js). No backend, no
  cloud sync, no auth until adoption is proven.

## Stack

- Expo SDK 54 — PINNED for Expo Go compatibility. Do not bump it.
- React Native, single codebase iOS + Android.
- expo-audio (NOT the deprecated expo-av).
- expo-sqlite ~16.x — async API. All DB access goes through `src/db.js`.
- OpenAI: `gpt-4o-transcribe` (STT), `gpt-4o-mini` (extraction).

## Extraction schema (exact — only JSON, no markdown)

```json
{
  "summary": "string",
  "people": ["string"],
  "topics": ["string"],
  "decisions": ["string"],
  "action_items": [{ "text": "string", "due_date": "ISO date or null" }]
}
```

`topics` covers everything that was "products" in the old medical schema.
Never add medical-specific fields back.

## Persistence — `src/db.js` (single data layer)

Public functions: `initDb()`, `saveNote(extraction, transcript)`,
`getNote(id)`, `getRecentNotes(limit)`, `searchNotes(query, limit)`,
`getOpenActionItems(limit)`, `completeActionItem(id)`,
`updateNote(note)`, `deleteNote(id)`.

Use ONLY these. `src/services/notesRepository.ts` is a thin async wrapper
around them — do not add a second data layer.

## Code structure

```
/src
  /screens    — RecordScreen, NotesListScreen, NoteDetailScreen
  /hooks      — stateful logic that wraps services (e.g. useRecorder, useNotes)
  /components — NoteCard, FollowUpRow, Tag, NoteEditForm
  /services   — transcription.ts, extraction.ts, notesRepository.ts (db.js wrapper)
  /types      — note.ts (Note, ActionItem — single source of truth)
  /lib        — dateFormat.ts, id.ts
  /config     — theme.ts, models.ts, prompts.ts
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

Example (roadmap step 4, agent Q&A): `types` (Query/Response shapes) → `prompts.ts`

- `models.ts` → `services/agent.ts` (tool-use loop over `searchNotes` /
  `getOpenActionItems`) → `useAgentQuery` hook → chat components → screen.

Definition of done — every feature checks:

- [ ] Serves the individual user (no manager / team / analytics surface).
- [ ] Every new file lives in ONE layer, with no upward imports.
- [ ] Types end-to-end, no `any` in the pipeline.
- [ ] Reuses the existing error-handling pattern — doesn't invent a new one.
- [ ] No dead code or leftover scaffolding from the attempt.

## Roadmap (in order)

1. ✅ persistence + schema generalisation
2. UI for notes list + open to-dos (reading from db.js)
3. reminders via `expo-calendar` (writes to device calendar)
4. agent Q&A: tool-use loop with gpt-4o-mini, tools = searchNotes / getOpenActionItems
5. write-actions (create calendar events etc.) + thin backend proxy for the OpenAI key

## Rules — DO NOT

- Add medical-specific fields (products/pharma terms belong under "topics").
- Add vector DB (keyword search is enough at this scale).
- Add a backend before step 5.
- Break Expo Go compatibility (no custom dev-build-only libraries without flagging it first).
- Put the OpenAI key in a backend before step 5 — it lives on-device until then.
- Create a second data layer beside `db.js`.

## Working agreement

- For any new feature: propose file structure + approach, then WAIT for approval
  before writing code.
- Find the EXISTING pattern for what you're doing and follow it. Do NOT introduce a
  new approach, library, or abstraction when one already exists. If nothing fits,
  say so and propose — don't improvise silently.
- Explain structural decisions briefly as you go.
