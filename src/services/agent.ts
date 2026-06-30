import { openaiPost } from './openaiClient';
import { notesRepository } from './notesRepository';
import { AGENT_MODEL } from '../config/models';
import { buildAgentSystemPrompt } from '../config/prompts';
import { buildAnchor } from '../lib/dateAnchor';
import type { Note } from '../types/note';
import type { ChatMessage, ToolCall, AgentResponse, CompactNote } from '../types/agent';

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: 'Search notes by keyword. Returns compact summaries without full transcripts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword(s) to search for' },
        },
        required: ['query'],
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
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notes_by_tag',
      description: 'Find notes mentioning a specific person, product, or company.',
      parameters: {
        type: 'object',
        properties: {
          tag_type: {
            type: 'string',
            enum: ['person', 'product', 'company'],
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
    products: n.products,
    open_actions: n.openActionCount ?? 0,
  }));
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
// Maps each tool name to a repository call. Errors are caught by the caller
// and returned to the model as an error string so the loop can continue.

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_notes':
      return toCompactNotes(await notesRepository.search(args.query as string));

    case 'get_note':
      return await notesRepository.get(args.id as string);

    case 'get_action_items':
      return await notesRepository.getActionItems({
        status: args.status as string | undefined,
        dueBefore: args.due_before as string | undefined,
        dueAfter: args.due_after as string | undefined,
      });

    case 'get_notes_by_tag':
      return toCompactNotes(
        await notesRepository.getNotesByTag(
          args.tag_type as 'person' | 'product' | 'company',
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

const MAX_ITERATIONS = 5;
const FALLBACK_ANSWER = 'Δεν μπόρεσα να βρω απάντηση.';

type ApiResponse = {
  choices: Array<{
    message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }>;
};

export async function runAgent(question: string): Promise<AgentResponse> {
  const { iso, weekday } = buildAnchor();
  const systemPrompt = buildAgentSystemPrompt(iso, weekday);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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
      return { answer: msg.content ?? FALLBACK_ANSWER, toolCallLog };
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      toolCallLog.push({ name: tc.function.name, args });

      let result: string;
      try {
        result = JSON.stringify(await dispatch(tc.function.name, args));
      } catch (e) {
        result = `error: ${e instanceof Error ? e.message : String(e)}`;
      }

      messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
    }
  }

  // Cap reached — return the last assistant text, if any
  const lastText = [...messages]
    .reverse()
    .find((m): m is Extract<ChatMessage, { role: 'assistant' }> => m.role === 'assistant' && !!m.content);
  return { answer: lastText?.content ?? FALLBACK_ANSWER, toolCallLog };
}
