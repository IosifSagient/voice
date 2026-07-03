export type ActionItem = {
  id?: string;
  text: string;
  due_date: string | null;
  due_time?: string | null;
  all_day?: boolean;
  status?: string;
  calendar_event_id?: string | null;
};

export type Note = {
  id: string;
  timestamp: number;
  summary: string;
  people: string[];
  topics: string[];       // general subjects/entities mentioned (includes organizations)
  decisions: string[];    // kept for old notes; new extractions produce []
  action_items: ActionItem[];
  transcript: string;
  openActionCount?: number;
};

// Deep-copies a Note so edits to the draft never mutate the displayed note.
// Lists every field explicitly so TypeScript flags a missing copy if Note gains a field.
export function copyNote(n: Note): Note {
  return {
    ...n,
    action_items: n.action_items.map((item) => ({ ...item })),
    people: [...n.people],
    topics: [...n.topics],
    decisions: [...n.decisions],
  };
}
