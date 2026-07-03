# VoiceNote

A personal voice-note assistant for Greek speakers. You speak, it transcribes,
extracts a structured note (people mentioned, topics, action items with due dates),
saves it on-device, and lets you ask questions about your notes later ("τι έχω να
κάνω αυτή την εβδομάδα;"). It is a personal-utility app — appointments, errands,
people, reminders, ideas — not a business or team tool. See [AGENTS.md](AGENTS.md)
for the full design philosophy and conventions.

## Architecture

Expo (SDK 54) + React Native + TypeScript, single codebase for iOS and Android.
All app data (transcripts, notes, action items) lives on-device in SQLite — there
is no server-side data store.

Code is organized in strict layers. Imports only point downward; a layer never
imports from a layer above it:

```
  screens       — wire hooks to components; hold only view-level state
  hooks         components
  services      — pipeline logic (transcription, extraction, agent, calendar, db wrapper)
  lib           — formatting/date helpers
  config   types   db.js   ← foundation, imports nothing from above
```

- `components` never call a service, hook, or `fetch`/OpenAI directly — they're pure
  props-in, callbacks-out.
- `hooks` are the only place `useState`/`useEffect` touch the pipeline.
- `services` never import a hook, component, or screen.
- `db.js` is the single persistence layer (expo-sqlite). `services/notesRepository.ts`
  is a thin async wrapper around it — there is no second data layer.

See AGENTS.md for the full invariant list and rationale.

## Data flow

```
record (expo-audio)
  → transcribe (OpenAI gpt-4o-transcribe, Greek) — src/services/transcription.ts
  → extract structured note (OpenAI gpt-4o-mini, JSON) — src/services/extraction.ts
  → saveNote() — src/db.js (expo-sqlite)
  → NotesListScreen / NoteDetailScreen (read via notesRepository)
  → ChatScreen agent — tool-use loop over notesRepository methods (src/services/agent.ts)
```

Both OpenAI calls (`transcription.ts`, `extraction.ts`, `agent.ts`) go through
`src/services/openaiClient.ts`, which posts to a Supabase Edge Function proxy
authenticated with the user's Supabase session token. **The OpenAI API key is never
present on the device** — see "Environment setup" below.

## Running the app

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `a`/`i` in the terminal for an
Android emulator / iOS simulator. `npm run android` / `npm run ios` / `npm run web`
are equivalent shortcuts for `expo start --android` / `--ios` / `--web`.

Sign-in (Supabase auth) is required before recording — the OpenAI proxy authenticates
every call with your session token.

## Testing

```bash
npm test
```

Runs the Jest suite (`jest-expo` preset) — unit tests for name normalization,
date parsing/formatting, the SQLite persistence layer (via a mocked `expo-sqlite`),
and the honorific-stripping/backfill policy. One test is intentionally `it.skip`ed
as a documented, currently-failing regression case for a known bug in `updateNote`
(see the comment at the top of `__tests__/updateNoteActionItemWipe.test.js`).

## Environment setup

No `.env` file or client-side OpenAI key is needed — `src/config/supabase.ts` holds
the Supabase project URL and a public anon key (safe to commit; Supabase anon keys
are designed to be public, access is enforced server-side). The actual OpenAI API
key lives only in the Supabase Edge Function (`supabase/functions/openai-proxy/`),
never in the mobile app bundle.

If you need to point the app at a different Supabase project (e.g. your own dev
project), update `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `src/config/supabase.ts` and
deploy `supabase/functions/openai-proxy` with an `OPENAI_API_KEY` secret set on that
project.
