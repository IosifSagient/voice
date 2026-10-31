import { EXTRACTION_MODEL } from "../config/models";
import { buildSystemPrompt } from "../config/prompts";
import { buildAnchor } from "../lib/dateAnchor";
import type { ActionItem } from "../types/note";
import { openaiPost } from "./openaiClient";

// Extraction-only: short_title stays off ActionItem so a hydrated Note can't
// carry it. Optional because a decoded share is also an ExtractedNote and has none.
export type ExtractedActionItem = ActionItem & {
  short_title?: string | null;
};

export type ExtractedNote = {
  summary: string;
  people: string[];
  topics: string[];
  action_items: ExtractedActionItem[];
};

// Looser than the prompt's 20 on purpose: a slightly long title still beats
// the full text on the widget.
const SHORT_TITLE_MAX = 24;

// Never truncates: a title cut mid-word misleads, and null falls back to the full text.
function parseShortTitle(raw: unknown, title: unknown): string | null {
  const reject = (reason: string): null => {
    if (__DEV__)
      console.log("[extraction:shortTitle] rejected", reason, { title, raw });
    return null;
  };

  if (raw === undefined || raw === null) return reject("missing");
  if (typeof raw !== "string") return reject("not a string");
  const shortTitle = raw.trim();
  if (!shortTitle) return reject("empty");
  if (shortTitle.length > SHORT_TITLE_MAX)
    return reject(`too long (${shortTitle.length})`);

  if (__DEV__) {
    console.log("[extraction:shortTitle] kept", {
      title,
      shortTitle,
      length: shortTitle.length,
    });
  }
  return shortTitle;
}

export async function extractNote(transcript: string): Promise<ExtractedNote> {
  const { iso, weekday, calendarBlock } = buildAnchor();
  const systemPrompt = buildSystemPrompt(iso, weekday, calendarBlock);

  const data = (await openaiPost("/chat/completions", {
    model: EXTRACTION_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
  })) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    summary: parsed.summary ?? "",
    people: Array.isArray(parsed.people) ? parsed.people : [],
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    action_items: Array.isArray(parsed.actions)
      ? parsed.actions.map((a: Record<string, unknown>) => ({
          text: (a.title as string) ?? "",
          short_title: parseShortTitle(a.short_title, a.title),
          due_date: (a.due_date as string) ?? null,
          due_time: (a.due_time as string) ?? null,
          all_day: a.all_day !== false,
        }))
      : [],
  };
}
