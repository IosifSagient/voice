import { buildSystemPrompt } from "../config/prompts";
import { EXTRACTION_MODEL } from "../config/models";
import type { ActionItem } from "../types/note";

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export type ExtractedNote = {
  summary: string;
  people: string[];
  products: string[];
  companies: string[];
  action_items: ActionItem[];
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Pure function — testable without React Native context.
export function buildAnchor(now: Date = new Date()): { iso: string; weekday: string; calendarBlock: string } {
  const iso = now.toLocaleString('sv', { timeZone: 'Europe/Athens' }).replace(' ', 'T');
  const weekday = now.toLocaleDateString('en-US', { timeZone: 'Europe/Athens', weekday: 'long' });

  // Build a Mon–Sun table for this week and next week so the model can look up
  // weekday → date without doing arithmetic (which LLMs get wrong).
  // Longer-horizon dates ("in 3 months", "next January") are computed by the model normally.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const jsDay = todayUtc.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(Date.UTC(y, m - 1, d - daysToMonday));

  const rows: string[] = [];
  for (let week = 0; week < 2; week++) {
    rows.push(week === 0 ? 'This week:' : 'Next week:');
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + week * 7 + i));
      const dateStr = day.toISOString().slice(0, 10);
      const dayName = DAYS[day.getUTCDay()];
      const marker = dateStr === todayUtc.toISOString().slice(0, 10) ? '  ← today' : '';
      rows.push(`  ${dayName}: ${dateStr}${marker}`);
    }
  }

  return { iso, weekday, calendarBlock: rows.join('\n') };
}

export async function extractNote(transcript: string): Promise<ExtractedNote> {
  if (!OPENAI_KEY) throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");

  const { iso, weekday, calendarBlock } = buildAnchor();
  const systemPrompt = buildSystemPrompt(iso, weekday, calendarBlock);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Extract ${res.status}: ${await res.text()}`);
  const data = await res.json();
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
