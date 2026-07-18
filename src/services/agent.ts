import { openaiPost } from './openaiClient';
import { notesRepository } from './notesRepository';
import { AGENT_MODEL } from '../config/models';
import { buildAgentSystemPrompt } from '../config/prompts';
import { buildAnchor } from '../lib/dateAnchor';
import type { Note } from '../types/note';
import type {
  ChatMessage,
  ToolCall,
  AgentResponse,
  CompactNote,
  VisibleMessage,
  LiteralSearchResult,
} from '../types/agent';

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description:
        "Search notes by keyword over transcript and summary text. Matching is accent-, case-, and Greek-final-sigma-insensitive, and tolerates common Greek noun/verb endings (a query for one grammatical form also matches other forms of the same word — singular/plural, different cases). Pass ONLY key content word(s), never whole sentences. Returns compact summaries without full transcripts.",
      parameters: {
        type: 'object',
        properties: {
          terms: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 4,
            description:
              "Key content word(s), 1-4 entries, OR'd together. Each entry must be a BARE content word — one noun or name — NOT an article (ο/η/το/τους/των/...), preposition, or whole phrase; articles/prepositions add no signal and are filtered automatically if included. Use more than one entry only for genuinely irregular words or close synonyms — not as a retry mechanism, endings are already handled automatically.",
          },
        },
        required: ['terms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_notes_in_range',
      description:
        "Canonical tool for a date-scoped question that ALSO filters by a topic/keyword (e.g. 'πόσες συναντήσεις είχα αυτή την εβδομάδα' — a topic word AND a period in one ask). Combines keyword search with a date-range filter in one query so the returned rows already match both — count them directly, do not call get_notes_by_date_range and judge topic matches yourself. Scopes on created_at (when the note was recorded), same as get_notes_by_date_range. Same Greek word-ending tolerance and term rules as search_notes.",
      parameters: {
        type: 'object',
        properties: {
          terms: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 4,
            description: "Key content word(s), 1-4 entries, OR'd together — same rules as search_notes's terms.",
          },
          from: { type: 'string', description: 'Start date YYYY-MM-DD (inclusive)' },
          to: { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' },
        },
        required: ['terms', 'from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_note',
      description: 'Retrieve full details of a specific note, including all action items and the original transcript.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Note ID returned by a search or list tool' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_action_items',
      description: 'Get action items filtered by status and/or due date.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'done'],
            description: 'Filter by status. Omit to return all statuses.',
          },
          due_before: {
            type: 'string',
            description: 'ISO date YYYY-MM-DD. Return items due on or before this date.',
          },
          due_after: {
            type: 'string',
            description: 'ISO date YYYY-MM-DD. Return items due after this date.',
          },
          overdue: {
            type: 'boolean',
            description:
              "Set true for 'overdue' / 'εκπρόθεσμο' questions — open items whose due date is strictly before today (Europe/Athens), computed by the app, not the model. When true, status/due_before/due_after are ignored.",
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notes_by_tag',
      description: 'Find notes mentioning a specific person or topic.',
      parameters: {
        type: 'object',
        properties: {
          tag_type: {
            type: 'string',
            enum: ['person', 'topic'],
          },
          value: { type: 'string', description: 'The name to look for' },
        },
        required: ['tag_type', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notes_by_date_range',
      description: 'Get notes recorded within a date range (both ends inclusive).',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date YYYY-MM-DD (inclusive)' },
          to: { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_notes',
      description: 'Get notes from the last N days.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days to look back. Default 7.' },
        },
      },
    },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function toCompactNotes(notes: Note[]): CompactNote[] {
  return notes.map((n) => ({
    id: n.id,
    date: new Date(n.timestamp).toISOString().slice(0, 10),
    summary: n.summary,
    people: n.people,
    topics: n.topics,
    open_actions: n.openActionCount ?? 0,
  }));
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
// Maps each tool name to a repository call. Errors are caught by the caller
// and returned to the model as an error string so the loop can continue.

async function dispatch(name: string, args: Record<string, unknown>, todayAthens: string): Promise<unknown> {
  switch (name) {
    case 'search_notes':
      return toCompactNotes(await notesRepository.search(args.terms as string[]));

    case 'search_notes_in_range':
      return toCompactNotes(
        await notesRepository.searchInRange(args.terms as string[], args.from as string, args.to as string)
      );

    case 'get_note':
      return await notesRepository.get(args.id as string);

    case 'get_action_items':
      return await notesRepository.getActionItems({
        status: args.status as string | undefined,
        dueBefore: args.due_before as string | undefined,
        dueAfter: args.due_after as string | undefined,
        overdue: args.overdue as boolean | undefined,
        todayAthens,
      });

    case 'get_notes_by_tag':
      return toCompactNotes(
        await notesRepository.getNotesByTag(
          args.tag_type as 'person' | 'topic',
          args.value as string
        )
      );

    case 'get_notes_by_date_range':
      return toCompactNotes(
        await notesRepository.getNotesByDateRange(args.from as string, args.to as string)
      );

    case 'get_recent_notes':
      return toCompactNotes(await notesRepository.getRecentByDays((args.days as number) ?? 7));

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Main loop ────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 8;
const FALLBACK_ANSWER = 'Δεν μπόρεσα να βρω απάντηση.';
// Distinct from FALLBACK_ANSWER: reached only when MAX_ITERATIONS is exhausted
// without any assistant message ever carrying content — i.e. the loop ran out
// of steps mid-reasoning, not "searched and genuinely found nothing." Keeping
// these separate matters both for the user (different phrasing) and for
// debugging (a real "not found" vs. exhaustion look identical otherwise).
const EXHAUSTED_ANSWER =
  'Η ερώτηση χρειάστηκε πολλά βήματα και δεν ολοκληρώθηκε — δοκίμασε να τη διατυπώσεις πιο συγκεκριμένα.';

// The did-you-mean question is templated here, not phrased by the model.
// Three rounds of prompt engineering couldn't make the model reliably
// execute search_notes(empty) → search_notes_literal → ask_clarification via
// instructions alone — it degraded as conversation history grew. The loop
// now runs the literal fallback unconditionally on every empty search_notes
// result (see the search_notes branch in runAgent below), so there is no
// model decision left to phrase around either; a deterministic template
// removes the dependency instead of adding another model call on top of it.
function buildClarificationQuestion(terms: string[]): string {
  return `Δεν βρήκα ακριβές αποτέλεσμα για «${terms.join(', ')}» — μήπως εννοείς κάποια από αυτές;`;
}

type ApiResponse = {
  choices: Array<{
    message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }>;
};

export async function runAgent(
  question: string,
  history: VisibleMessage[] = [],
): Promise<AgentResponse> {
  const { iso, weekday, calendarBlock } = buildAnchor();
  const systemPrompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
  // Athens calendar day, from the same anchor as the prompt — the "today" used
  // to resolve get_action_items({ overdue: true }) in code, not by the model.
  const todayAthens = iso.slice(0, 10);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    // Prior visible turns give the model multi-turn context.
    // Tool rounds from previous calls are NOT included — they stay internal.
    ...history.map((m): ChatMessage => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const toolCallLog: { name: string; args: unknown }[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const data = (await openaiPost('/chat/completions', {
      model: AGENT_MODEL,
      temperature: 0.2,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
    })) as ApiResponse;

    const msg = data.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { kind: 'answer', answer: msg.content ?? FALLBACK_ANSWER, toolCallLog };
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      toolCallLog.push({ name: tc.function.name, args });

      let result: string;
      try {
        const toolResult = await dispatch(tc.function.name, args, todayAthens);

        // Loop-driven did-you-mean fallback: runs unconditionally whenever
        // search_notes comes back empty, regardless of anything the model
        // does or doesn't decide — see buildClarificationQuestion above.
        if (tc.function.name === 'search_notes' && Array.isArray(toolResult) && toolResult.length === 0) {
          const terms = (args.terms as string[]) ?? [];
          let literalResult: LiteralSearchResult = { lowConfidence: true, query: terms, candidates: [] };
          try {
            literalResult = await notesRepository.searchLiteral(terms);
          } catch (literalErr) {
            // Degrade gracefully to "no candidates" — same stance as
            // searchNotes/searchNotesInRange's own FTS5-failure handling in
            // db/fts.js: a broken fallback must not break the whole turn.
            console.error('[agent:runAgent] search_notes_literal(auto) failed, treating as no candidates', literalErr);
          }
          // Marked distinguishably in the log — this call was never made by
          // the model, so on-device traces must be able to tell it apart
          // from a real model-initiated tool call.
          toolCallLog.push({ name: 'search_notes_literal(auto)', args: { terms } });
          if (__DEV__) {
            console.log(
              '[agent:tool]',
              'search_notes_literal(auto)',
              { terms },
              `candidates=${literalResult.candidates.length}`,
            );
          }

          if (literalResult.candidates.length > 0) {
            return {
              kind: 'clarification',
              question: buildClarificationQuestion(terms),
              candidates: literalResult.candidates,
              toolCallLog,
            };
          }
          // Both search_notes and the literal fallback came back empty —
          // toolResult is still the original plain [], sent to the model
          // below exactly like any other empty tool result. No envelope, no
          // special shape: the model's already-reliable "say not found"
          // behavior handles this unchanged.
        }

        result = JSON.stringify(toolResult);
        if (__DEV__) {
          const rowCount = Array.isArray(toolResult) ? toolResult.length : toolResult == null ? 0 : 1;
          console.log('[agent:tool]', tc.function.name, args, `rows=${rowCount}`);
        }
      } catch (e) {
        result = `error: ${e instanceof Error ? e.message : String(e)}`;
        if (__DEV__) {
          console.log('[agent:tool]', tc.function.name, args, 'error:', result);
        }
      }

      messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
    }
  }

  // Cap reached — return the last assistant text, if any. If none exists
  // (every iteration was a tool call), this is genuine iteration exhaustion,
  // not "searched and found nothing" — say so distinctly (see EXHAUSTED_ANSWER).
  const lastText = [...messages]
    .reverse()
    .find((m): m is Extract<ChatMessage, { role: 'assistant' }> => m.role === 'assistant' && !!m.content);
  return { kind: 'answer', answer: lastText?.content ?? EXHAUSTED_ANSWER, toolCallLog };
}
