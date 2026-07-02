import { useState } from 'react';
import { runAgent } from '../services/agent';
import type { VisibleMessage } from '../types/agent';

type State = {
  messages: VisibleMessage[];
  isThinking: boolean;
  error: string | null;
};

export function useAgentChat() {
  const [state, setState] = useState<State>({
    messages: [],
    isThinking: false,
    error: null,
  });

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Capture history BEFORE appending the new user turn.
    // runAgent receives prior turns and appends 'question' itself.
    const historySnapshot = state.messages;

    setState((s) => ({
      ...s,
      messages: [...s.messages, { role: 'user', content: trimmed }],
      isThinking: true,
      error: null,
    }));

    try {
      const res = await runAgent(trimmed, historySnapshot);
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', content: res.answer }],
        isThinking: false,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          { role: 'assistant', content: 'Κάτι πήγε στραβά, δοκίμασε ξανά.' },
        ],
        isThinking: false,
        error: msg,
      }));
    }
  };

  return { ...state, send };
}
