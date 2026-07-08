export type TaskFilter = "all" | "pending" | "completed" | "overdue";

export type TaskWithContext = {
  id: string;
  noteId: string;
  text: string;
  dueDate: string | null; // ISO 'YYYY-MM-DD' (converted from ms at read time)
  dueTime: string | null;
  allDay: boolean;
  status: "open" | "done";
  calendarEventId: string | null;
  createdAt: number;
  // parent note context
  noteSummary: string;
  notePeople: string[];
};

// TaskWithContext narrowed to rows that are guaranteed to have a due date
// (what getTasksWithDueDates returns) — lets bucketing code compare dueDate
// as a string without null-checking.
export type TaskWithDueDate = TaskWithContext & { dueDate: string };

export type TaskBuckets = {
  overdue: TaskWithDueDate[];
  today: TaskWithDueDate[];
  upcoming: TaskWithDueDate[];
};
