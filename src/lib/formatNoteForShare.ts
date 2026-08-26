import type { Note } from "../types/note";
import { formatDueDate } from "./dateFormat";

// Formats a note's extracted fields as Greek plain text for clipboard copy
// (Increment 1 "copy note"). Transcript is deliberately excluded — this is
// the formatted note, not the raw recording text.
export function formatNoteForShare(note: Note): string {
  const sections: string[] = [];

  const summary = note.summary.trim();
  if (summary) {
    sections.push(`Περίληψη:\n${summary}`);
  }

  const actionLines = note.action_items
    .filter((item) => item.text.trim().length > 0)
    .map((item) => {
      const text = item.text.trim();
      const due = formatDueDate(item.due_date);
      return due ? `- ${text} (έως ${due})` : `- ${text}`;
    });
  if (actionLines.length > 0) {
    sections.push(`Ενέργειες:\n${actionLines.join("\n")}`);
  }

  if (note.people.length > 0) {
    sections.push(`Άτομα: ${note.people.join(", ")}`);
  }

  if (note.topics.length > 0) {
    sections.push(`Θέματα: ${note.topics.join(", ")}`);
  }

  return sections.join("\n\n");
}
