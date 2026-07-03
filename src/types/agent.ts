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

// Visible conversation turn — user and assistant text only.
// Tool rounds are internal to the agent loop and never appear here.
export type VisibleMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentResponse = {
  answer: string;
  toolCallLog: { name: string; args: unknown }[];
};
