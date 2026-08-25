export type ActionItem = {
  id?: string;
  text: string;
  due_date: string | null;
  due_time?: string | null;
  all_day?: boolean;
  status?: string;
  calendar_event_id?: string | null;
  notification_id?: string | null;
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

// A single action item's calendar/notification reminder identifiers — returned
// by db.js write paths that remove or replace rows, so callers (hooks) can
// cancel the corresponding expo-calendar/expo-notifications entries. db.js
// itself never imports those services (see the layer dependency rule).
export type ReminderIds = {
  calendarEventId: string | null;
  notificationId: string | null;
};

// Returned by db.js's updateNote(): what happened to each existing open
// action item's reminders across an edit-save.
export type UpdateNoteDiff = {
  removed: ReminderIds[];
  changed: Array<ReminderIds & { id: string; item: ActionItem }>;
};

// One row of the notes list's flat FlatList data array, after grouping notes
// under date headers (lib/groupNotesByDate.ts) — a header row never carries a
// note, so renderItem/keyExtractor can switch on `type` without touching db/
// or service types.
export type NoteListItem =
  | { type: "header"; key: string; label: string }
  | { type: "note"; key: string; note: Note };

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
