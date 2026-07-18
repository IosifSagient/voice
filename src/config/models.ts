export const TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
export const EXTRACTION_MODEL = "gpt-4o-mini";
export const AGENT_MODEL = "gpt-4o-mini";

// Max prior VisibleMessage turns resent as context on each runAgent call —
// caps unbounded chat-history growth within a session (the full history stays
// in React state for UI display; only what's sent to the model is windowed).
// Starting value, not a verified optimum — tune from on-device use.
export const HISTORY_WINDOW = 12;
