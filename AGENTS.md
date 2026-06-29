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
- Explain structural decisions briefly as you go.
