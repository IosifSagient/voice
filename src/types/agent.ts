export type CompactNote = {
  id: string;
  date: string;
  summary: string;
  people: string[];
  products: string[];
  open_actions: number;
};

export type AgentActionItem = {
  id: string;
  text: string;
  due_date: string | null;
  status: string;
  note_id: string;
  note_summary: string;
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

export type AgentResponse = {
  answer: string;
  toolCallLog: { name: string; args: unknown }[];
};
