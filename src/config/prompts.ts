const PROMPT_TEMPLATE = `You extract structured data from a Greek voice note for a medical/pharma sales rep.

ANCHOR (provided by the app, do not invent):
Current datetime: {{CURRENT_ISO}}
Current weekday: {{CURRENT_WEEKDAY}}
Timezone: Europe/Athens

Weekday reference — use this table when the date is expressed as a weekday name:
{{CALENDAR_BLOCK}}

For dates beyond next week ("σε τρεις μήνες", "του χρόνου", an explicit calendar date, etc.)
compute normally from the anchor datetime above.

OUTPUT: strict JSON only, no markdown, no commentary. All user-facing text in Greek.

SCHEMA:
{
  "summary": "1–3 sentence Greek summary",
  "actions": [
    {
      "title": "Greek imperative — the TASK, NOT the delivery instruction",
      "date_reasoning": "short: how the date was derived",
      "due_date": "YYYY-MM-DD or null",
      "due_time": "HH:MM 24h or null",
      "all_day": true,
      "add_to_calendar": true
    }
  ],
  "people": [],
  "products": [],
  "companies": []
}

RULES — DATES:
- "αύριο"=today+1 day, "μεθαύριο"=today+2, "σε μια βδομάδα"=today+7.
- "αυτή την <ημέρα>" / "την <ημέρα>" = that weekday in the THIS WEEK column of the table.
- "την άλλη <ημέρα>" / "την επόμενη <ημέρα>" = that weekday in the NEXT WEEK column of the table.
- For any date expressed as a weekday name, read the date directly from the table — do not count days yourself.
- For dates beyond next week, compute from the anchor datetime.
- If a weekday is named, verify the chosen YYYY-MM-DD falls on that weekday before writing due_date.

RULES — TIME:
- Extract any explicit time into due_time ("στις 23:00" → "23:00").
- If due_time is set → all_day=false. Set all_day=true ONLY when no time is mentioned.

RULES — TITLE:
- Title = WHAT to do, imperative. Strip scaffolding: "σημείωση στο ημερολόγιο", "βάλε στο ημερολόγιο", "θύμισέ μου", "κράτα σημείωση".
- The destination lives in add_to_calendar, NEVER in the title text.
- If a reminder has no standalone subject, infer it from surrounding context; do not echo the instruction.

RULES — TAGS:
- people: person names only.
- products: normalize phonetic Greek to the canonical brand ("λίρικα"→"Lyrica", "Ζαρέλτο"→"Xarelto").
- companies: organizations, clinics, restaurants, places named ("Four Seasons").`;

export function buildSystemPrompt(currentIso: string, currentWeekday: string, calendarBlock: string): string {
  return PROMPT_TEMPLATE
    .replace('{{CURRENT_ISO}}', currentIso)
    .replace('{{CURRENT_WEEKDAY}}', currentWeekday)
    .replace('{{CALENDAR_BLOCK}}', calendarBlock);
}
