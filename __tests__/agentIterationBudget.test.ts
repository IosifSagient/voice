// Regression coverage for the MAX_ITERATIONS budget and the distinct
// exhaustion fallback in runAgent (src/services/agent.ts): the did-you-mean
// chain alone costs 3 round-trips before real answering begins, so the loop
// must survive at least that many tool-call rounds, and running out of steps
// must read differently from a genuine "nothing found" answer.

jest.mock('../src/services/openaiClient', () => ({
  openaiPost: jest.fn(),
}));

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    search: jest.fn(),
    searchInRange: jest.fn(),
    searchLiteral: jest.fn(),
    get: jest.fn(),
    getActionItems: jest.fn(),
    getNotesByTag: jest.fn(),
    getNotesByDateRange: jest.fn(),
    getRecentByDays: jest.fn(),
  },
}));

import { openaiPost } from '../src/services/openaiClient';
import { notesRepository } from '../src/services/notesRepository';
import { runAgent } from '../src/services/agent';

function toolCallMsg(name: string, args: Record<string, unknown> = {}) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id: 'call_0', type: 'function', function: { name, arguments: JSON.stringify(args) } }],
  };
}
function apiResponse(message: ReturnType<typeof toolCallMsg>) {
  return { choices: [{ message, finish_reason: 'tool_calls' }] };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): also drains any queued
  // mockResolvedValueOnce responses left over from a prior test — otherwise a
  // test that under-consumes its queue leaks a stale response into the next
  // test's first openaiPost call.
  jest.resetAllMocks();
});

describe('runAgent — iteration budget', () => {
  it('survives 7 tool-call rounds and still lands a real answer on round 8 — would have exhausted under the old budget of 5', async () => {
    (notesRepository.get as jest.Mock).mockResolvedValue({ id: 'n1' });

    // openaiPost is called once PER ITERATION (not once per tool call), so
    // MAX_ITERATIONS=8 permits at most 8 calls total: 7 tool-call rounds here,
    // then the loop's 8th and final call is a plain answer.
    for (let i = 0; i < 7; i++) {
      (openaiPost as jest.Mock).mockResolvedValueOnce(apiResponse(toolCallMsg('get_note', { id: 'n1' })));
    }
    (openaiPost as jest.Mock).mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'Η απάντηση.' }, finish_reason: 'stop' }],
    });

    const res = await runAgent('ερώτηση');

    expect(res.kind).toBe('answer');
    if (res.kind === 'answer') expect(res.answer).toBe('Η απάντηση.');
    expect(openaiPost).toHaveBeenCalledTimes(8);
  });

  it('returns the distinct exhaustion message (not the generic "no answer" one) when the budget runs out mid-tool-calling', async () => {
    (notesRepository.get as jest.Mock).mockResolvedValue({ id: 'n1' });

    // Every single iteration up to the cap (8) is a tool call with null
    // content — no assistant text is ever produced, so this must hit real
    // exhaustion, not a normal answer.
    for (let i = 0; i < 8; i++) {
      (openaiPost as jest.Mock).mockResolvedValueOnce(apiResponse(toolCallMsg('get_note', { id: 'n1' })));
    }

    const res = await runAgent('ερώτηση ατελείωτη');

    expect(res.kind).toBe('answer');
    if (res.kind === 'answer') {
      expect(res.answer).toContain('πολλά βήματα');
      expect(res.answer).not.toBe('Δεν μπόρεσα να βρω απάντηση.');
    }
  });

  it('keeps the ORIGINAL generic fallback for a normal single-turn null-content response (not exhaustion)', async () => {
    (openaiPost as jest.Mock).mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'stop' }],
    });

    const res = await runAgent('ερώτηση');

    expect(res.kind).toBe('answer');
    if (res.kind === 'answer') expect(res.answer).toBe('Δεν μπόρεσα να βρω απάντηση.');
  });
});
