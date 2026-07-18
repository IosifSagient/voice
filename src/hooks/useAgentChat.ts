import { useState } from "react";
import { runAgent } from "../services/agent";
import { HISTORY_WINDOW } from "../config/models";
import type { VisibleMessage } from "../types/agent";

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
    // Windowed to the most recent HISTORY_WINDOW turns — state.messages
    // itself stays full for UI display; only what's sent to the model is capped.
    const historySnapshot = state.messages.slice(-HISTORY_WINDOW);

    setState((s) => ({
      ...s,
      messages: [...s.messages, { role: "user", content: trimmed }],
      isThinking: true,
      error: null,
    }));

    try {
      const res = await runAgent(trimmed, historySnapshot);
      const assistantMessage =
        res.kind === "clarification"
          ? { role: "assistant" as const, content: res.question, clarification: { candidates: res.candidates } }
          : { role: "assistant" as const, content: res.answer };
      setState((s) => ({
        ...s,
        messages: [...s.messages, assistantMessage],
        isThinking: false,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          { role: "assistant", content: "Κάτι πήγε στραβά, δοκίμασε ξανά." },
        ],
        isThinking: false,
        error: msg,
      }));
    }
  };

  const clear = () => {
    setState({
      messages: [],
      isThinking: false,
      error: null,
    });
  };
  return { ...state, send, clear };
}
