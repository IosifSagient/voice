export type CompactNote = {
  id: string;
  date: string;
  summary: string;
  people: string[];
  topics: string[];
  open_actions: number;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

// One low-confidence substring hit from search_notes_literal — the
// "did you mean?" fallback that only runs after search_notes finds nothing.
export type LiteralMatchCandidate = {
  noteId: string;
  date: string;
  summary: string;
  field: 'transcript' | 'summary';
  snippet: string;
  matchOffset: number; // relative to `snippet`, not the full note text
  matchLength: number;
  confidence: 'whole_word' | 'word_prefix' | 'mid_word';
};

export type LiteralSearchResult = {
  lowConfidence: true;
  query: string | string[];
  candidates: LiteralMatchCandidate[];
};

// Visible conversation turn — user and assistant text only.
// Tool rounds are internal to the agent loop and never appear here.
// `clarification` is set only on an assistant turn produced by the
// ask_clarification path (see services/agent.ts) — its candidates always
// come from loop state, never from unvalidated model output.
export type VisibleMessage = {
  role: 'user' | 'assistant';
  content: string;
  clarification?: { candidates: LiteralMatchCandidate[] };
};

export type AgentResponse =
  | { kind: 'answer'; answer: string; toolCallLog: { name: string; args: unknown }[] }
  | {
      kind: 'clarification';
      question: string;
      candidates: LiteralMatchCandidate[];
      toolCallLog: { name: string; args: unknown }[];
    };
