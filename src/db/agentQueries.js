import { getDb } from "./connection";
import { parseDueDate, safeParseArray } from "./shared";

export async function getActionItemsFiltered({
  status,
  dueBefore,
  dueAfter,
} = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }
  if (dueBefore) {
    const ts = parseDueDate(dueBefore);
    if (ts != null) {
      // inclusive: end of that day
      conditions.push("a.due_date IS NOT NULL AND a.due_date <= ?");
      params.push(ts + 86400000 - 1);
    }
  }
  if (dueAfter) {
    const ts = parseDueDate(dueAfter);
    if (ts != null) {
      conditions.push("(a.due_date IS NULL OR a.due_date > ?)");
      params.push(ts + 86400000 - 1);
    }
  }

  const where =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const rows = await db.getAllAsync(
    `SELECT a.id, a.text, a.due_date, a.due_time, a.all_day, a.status,
       a.calendar_event_id, a.notification_id, a.created_at, a.note_id,
       n.summary AS note_summary, n.people_json
     FROM action_items a
     JOIN notes n ON a.note_id = n.id
     ${where}
     ORDER BY (a.due_date IS NULL), a.due_date ASC
     LIMIT 50`,
    ...params,
  );
  return rows.map((r) => ({
    id: r.id,
    noteId: r.note_id,
    text: r.text,
    dueDate: r.due_date
      ? new Date(r.due_date).toISOString().slice(0, 10)
      : null,
    dueTime: r.due_time ?? null,
    allDay: r.all_day !== 0,
    status: r.status,
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
    createdAt: r.created_at,
    noteSummary: r.note_summary ?? "",
    notePeople: safeParseArray(r.people_json, r.note_id, "people_json"),
  }));
}

// All open action items with a due_date, joined with parent note context.
// No date-bucket filtering here — that's done in the service layer
// (src/services/taskBuckets.ts) so the boundary logic is testable in JS.
export async function getTasksWithDueDates() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT a.id, a.text, a.due_date, a.due_time, a.all_day, a.status,
       a.calendar_event_id, a.notification_id, a.created_at, a.note_id,
       n.summary AS note_summary, n.people_json
     FROM action_items a
     JOIN notes n ON a.note_id = n.id
     WHERE a.status = 'open' AND a.due_date IS NOT NULL
     ORDER BY a.due_date ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    noteId: r.note_id,
    text: r.text,
    dueDate: new Date(r.due_date).toISOString().slice(0, 10),
    dueTime: r.due_time ?? null,
    allDay: r.all_day !== 0,
    status: r.status,
    calendarEventId: r.calendar_event_id ?? null,
    notificationId: r.notification_id ?? null,
    createdAt: r.created_at,
    noteSummary: r.note_summary ?? "",
    notePeople: safeParseArray(r.people_json, r.note_id, "people_json"),
  }));
}
