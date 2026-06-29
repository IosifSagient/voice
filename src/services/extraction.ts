import { buildSystemPrompt } from "../config/prompts";
import { EXTRACTION_MODEL } from "../config/models";
import { buildAnchor } from "../lib/dateAnchor";
import { openaiPost } from "./openaiClient";
import type { ActionItem } from "../types/note";

export type ExtractedNote = {
  summary: string;
  people: string[];
  products: string[];
  companies: string[];
  action_items: ActionItem[];
};

export async function extractNote(transcript: string): Promise<ExtractedNote> {
  const { iso, weekday, calendarBlock } = buildAnchor();
  const systemPrompt = buildSystemPrompt(iso, weekday, calendarBlock);

  const data = await openaiPost("/chat/completions", {
    model: EXTRACTION_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
  }) as { choices: Array<{ message: { content: string } }> };
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    summary: parsed.summary ?? "",
    people: Array.isArray(parsed.people) ? parsed.people : [],
    products: Array.isArray(parsed.products) ? parsed.products : [],
    companies: Array.isArray(parsed.companies) ? parsed.companies : [],
    action_items: Array.isArray(parsed.actions)
      ? parsed.actions.map((a: Record<string, unknown>) => ({
          text: (a.title as string) ?? "",
          due_date: (a.due_date as string) ?? null,
          due_time: (a.due_time as string) ?? null,
          all_day: a.all_day !== false,
        }))
      : [],
  };
}
