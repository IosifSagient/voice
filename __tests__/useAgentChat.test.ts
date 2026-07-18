// Regression coverage for useAgentChat's history windowing (src/hooks/useAgentChat.ts):
// the full VisibleMessage[] stays in React state for UI display, but only the
// most recent HISTORY_WINDOW turns are resent to runAgent as context, to cap
// unbounded per-session context growth (see the cross-turn degradation eval).

import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAgentChat } from '../src/hooks/useAgentChat';
import { runAgent } from '../src/services/agent';
import { HISTORY_WINDOW } from '../src/config/models';
import type { VisibleMessage } from '../src/types/agent';

jest.mock('../src/services/agent', () => ({
  runAgent: jest.fn(),
}));

const mockRunAgent = runAgent as jest.Mock;

async function renderUseAgentChat() {
  let hookResult!: ReturnType<typeof useAgentChat>;
  function TestComponent() {
    hookResult = useAgentChat();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return { getResult: () => hookResult };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useAgentChat — history windowing', () => {
  it('sends the full history to runAgent when it is shorter than HISTORY_WINDOW', async () => {
    mockRunAgent.mockResolvedValue({ kind: 'answer', answer: 'ok', toolCallLog: [] });
    const { getResult } = await renderUseAgentChat();

    await act(async () => {
      await getResult().send('πρώτη ερώτηση');
    });

    expect(mockRunAgent).toHaveBeenCalledWith('πρώτη ερώτηση', []);
  });

  it('caps the history sent to runAgent at HISTORY_WINDOW, dropping the oldest turns and keeping the newest', async () => {
    mockRunAgent.mockResolvedValue({ kind: 'answer', answer: 'ok', toolCallLog: [] });
    const { getResult } = await renderUseAgentChat();

    // Send enough turns that state.messages grows well past HISTORY_WINDOW —
    // each send() appends a user turn then an assistant turn (2 per round).
    const rounds = HISTORY_WINDOW; // guarantees > HISTORY_WINDOW messages accumulated
    for (let i = 0; i < rounds; i++) {
      await act(async () => {
        await getResult().send(`ερώτηση ${i}`);
      });
    }

    // The full, un-windowed history is still all present in React state.
    expect(getResult().messages.length).toBe(rounds * 2);

    // But the LAST call to runAgent must have received at most HISTORY_WINDOW
    // entries, and they must be the newest ones (oldest dropped from the tail).
    const lastCallHistory = mockRunAgent.mock.calls[mockRunAgent.mock.calls.length - 1][1] as VisibleMessage[];
    expect(lastCallHistory.length).toBe(HISTORY_WINDOW);

    // Exclude the final round's user+assistant turns — historySnapshot for
    // that round was captured BEFORE either was appended to state.messages.
    const fullHistoryBeforeLastSend = getResult().messages.slice(0, -2);
    const expectedWindow = fullHistoryBeforeLastSend.slice(-HISTORY_WINDOW);
    expect(lastCallHistory).toEqual(expectedWindow);

    // Newest turns preserved, oldest dropped: the windowed history must NOT
    // contain the very first turn ever sent.
    expect(lastCallHistory.some((m) => m.content === 'ερώτηση 0')).toBe(false);
  });

  it('keeps state.messages unwindowed for UI display regardless of how long the session gets', async () => {
    mockRunAgent.mockResolvedValue({ kind: 'answer', answer: 'ok', toolCallLog: [] });
    const { getResult } = await renderUseAgentChat();

    for (let i = 0; i < HISTORY_WINDOW + 3; i++) {
      await act(async () => {
        await getResult().send(`ερώτηση ${i}`);
      });
    }

    expect(getResult().messages.length).toBe((HISTORY_WINDOW + 3) * 2);
    expect(getResult().messages[0].content).toBe('ερώτηση 0');
  });
});
