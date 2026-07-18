// Regression coverage for the "did you mean?" clarification flow in runAgent
// (src/services/agent.ts). This flow is now LOOP-DRIVEN, not model-driven:
// the loop itself calls searchLiteral whenever search_notes comes back empty
// and decides unconditionally whether to short-circuit into a clarification —
// the model never calls a tool to make this decision (search_notes_literal /
// ask_clarification no longer exist as model-callable tools at all). That
// means the trigger is a pure function of the current turn's search_notes
// result, immune to conversation history by construction — see test (d).

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
import type { VisibleMessage } from '../src/types/agent';

function toolCallMsg(calls: { name: string; args?: Record<string, unknown> }[]) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: calls.map((c, i) => ({
      id: `call_${i}`,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
    })),
  };
}
function finalMsg(content: string) {
  return { role: 'assistant', content };
}
function apiResponse(message: ReturnType<typeof toolCallMsg> | ReturnType<typeof finalMsg>) {
  return {
    choices: [
      { message, finish_reason: 'tool_calls' in message && message.tool_calls ? 'tool_calls' : 'stop' },
    ],
  };
}

const literalCandidate = (overrides: Partial<Record<string, unknown>> = {}) => ({
  noteId: 'n1',
  date: '2026-01-01',
  summary: 's',
  field: 'transcript',
  snippet: 'abc',
  matchOffset: 1,
  matchLength: 1,
  confidence: 'whole_word',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runAgent — did-you-mean is loop-driven, not model-driven', () => {
  it('(a) search_notes empty + literal hits → kind:"clarification" with correct candidates, NO follow-up model call for the decision or phrasing', async () => {
    (notesRepository.search as jest.Mock).mockResolvedValue([]);
    const candidates = [literalCandidate()];
    (notesRepository.searchLiteral as jest.Mock).mockResolvedValue({
      lowConfidence: true,
      query: ['καφές'],
      candidates,
    });
    (openaiPost as jest.Mock).mockResolvedValueOnce(
      apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['καφές'] } }])),
    );

    const res = await runAgent('τι έγραψα για τον καφέ;');

    expect(res.kind).toBe('clarification');
    if (res.kind === 'clarification') {
      expect(res.candidates).toEqual(candidates);
      expect(res.question).toContain('καφές');
    }
    // The whole decision + phrasing happened inside the SAME openaiPost
    // round that returned the empty search_notes result — no second call.
    expect(openaiPost).toHaveBeenCalledTimes(1);
    expect(notesRepository.searchLiteral).toHaveBeenCalledWith(['καφές']);
  });

  it('(b) both search_notes and literal empty → model answers not-found normally on its next call; the auto literal attempt is logged distinctly', async () => {
    (notesRepository.search as jest.Mock).mockResolvedValue([]);
    (notesRepository.searchLiteral as jest.Mock).mockResolvedValue({
      lowConfidence: true,
      query: ['ανύπαρκτος'],
      candidates: [],
    });
    (openaiPost as jest.Mock)
      .mockResolvedValueOnce(apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['ανύπαρκτος'] } }])))
      .mockResolvedValueOnce(apiResponse(finalMsg('Δεν βρέθηκε τίποτα.')));

    const res = await runAgent('τι έγραψα για ανύπαρκτος;');

    expect(res.kind).toBe('answer');
    if (res.kind === 'answer') expect(res.answer).toBe('Δεν βρέθηκε τίποτα.');
    expect(notesRepository.searchLiteral).toHaveBeenCalledTimes(1);
    expect(openaiPost).toHaveBeenCalledTimes(2);

    // toolCallLog never shows a model-initiated search_notes_literal or
    // ask_clarification call — those tools don't exist anymore — only the
    // real search_notes call plus the internal, distinctly-marked auto entry.
    expect(res.toolCallLog.map((t) => t.name)).toEqual(['search_notes', 'search_notes_literal(auto)']);
  });

  it('passes ALL of search_notes\'s OR\'d terms through to the literal fallback unmodified (multi-term pass-through)', async () => {
    (notesRepository.search as jest.Mock).mockResolvedValue([]);
    const candidates = [literalCandidate({ noteId: 'n3' })];
    (notesRepository.searchLiteral as jest.Mock).mockResolvedValue({
      lowConfidence: true,
      query: ['καφές', 'καφετέρια'],
      candidates,
    });
    (openaiPost as jest.Mock).mockResolvedValueOnce(
      apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['καφές', 'καφετέρια'] } }])),
    );

    const res = await runAgent('τι έγραψα για καφέ ή καφετέρια;');

    // Both OR'd terms reach the DB layer intact — per-term matching and
    // cross-term dedup are db/fts.js's responsibility (covered there); the
    // loop's job is only to forward the full array without dropping any entry.
    expect(notesRepository.searchLiteral).toHaveBeenCalledWith(['καφές', 'καφετέρια']);
    expect(res.kind).toBe('clarification');
    if (res.kind === 'clarification') {
      expect(res.candidates).toEqual(candidates);
      expect(res.question).toContain('καφές, καφετέρια');
    }
  });

  it('(c) search_notes non-empty → literal never runs (regression guard)', async () => {
    (notesRepository.search as jest.Mock).mockResolvedValue([
      { id: 'n1', timestamp: Date.now(), summary: 'βρέθηκε', people: [], topics: [], openActionCount: 0 },
    ]);
    (openaiPost as jest.Mock)
      .mockResolvedValueOnce(apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['test'] } }])))
      .mockResolvedValueOnce(apiResponse(finalMsg('Βρήκα μια σημείωση.')));

    const res = await runAgent('τι έγραψα για test;');

    expect(res.kind).toBe('answer');
    if (res.kind === 'answer') expect(res.answer).toBe('Βρήκα μια σημείωση.');
    expect(res).not.toHaveProperty('candidates');
    expect(res).not.toHaveProperty('question');
    expect(notesRepository.searchLiteral).not.toHaveBeenCalled();
  });

  it('(d) HEADLINE: same-term re-ask with a long synthetic history behaves byte-identically to a fresh chat', async () => {
    (notesRepository.search as jest.Mock).mockResolvedValue([]);
    const candidates = [literalCandidate({ noteId: 'n2' })];
    (notesRepository.searchLiteral as jest.Mock).mockResolvedValue({
      lowConfidence: true,
      query: ['καφές'],
      candidates,
    });

    // 10+ prior turns, including an earlier mention of the SAME term, to
    // simulate exactly the on-device scenario that used to suppress the
    // model-driven chain (history growth, term reappearing from an earlier
    // turn). None of it can reach the trigger anymore: it's a pure function
    // of THIS turn's search_notes result, not of `history` at all.
    const longHistory: VisibleMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 0 ? 'είχα ρωτήσει παλιότερα για καφές' : `μήνυμα ${i}`,
    }));

    (openaiPost as jest.Mock).mockResolvedValueOnce(
      apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['καφές'] } }])),
    );
    const freshRes = await runAgent('τι έγραψα για τον καφέ;', []);

    (openaiPost as jest.Mock).mockResolvedValueOnce(
      apiResponse(toolCallMsg([{ name: 'search_notes', args: { terms: ['καφές'] } }])),
    );
    const longHistoryRes = await runAgent('τι έγραψα για τον καφέ;', longHistory);

    expect(freshRes.kind).toBe('clarification');
    expect(longHistoryRes.kind).toBe('clarification');
    if (freshRes.kind === 'clarification' && longHistoryRes.kind === 'clarification') {
      expect(longHistoryRes.candidates).toEqual(freshRes.candidates);
      expect(longHistoryRes.question).toBe(freshRes.question);
    }
  });
});
