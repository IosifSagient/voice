import type { TaskWithDueDate, TaskBuckets } from "../types/tasks";
import { toLocalDateString } from "../lib/localDate";

// Buckets pre-sorted (due_date ascending, per getTasksWithDueDates) rows into
// overdue / today / upcoming (next 7 days inclusive, beyond that excluded).
// "Today" and the 7-day cutoff are both derived from `now`'s local calendar
// components. The cutoff is built via new Date(y, m, d + 7) rather than
// now.getTime() + 7*86400000 — a fixed-millis offset shifts by an hour across
// a DST transition, which can land on the wrong calendar day near midnight.
export function bucketTasksByDueDate(
  tasks: TaskWithDueDate[],
  now: Date = new Date(),
): TaskBuckets {
  const todayLocal = toLocalDateString(now);
  const upcomingCutoff = toLocalDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
  );

  const overdue: TaskWithDueDate[] = [];
  const today: TaskWithDueDate[] = [];
  const upcoming: TaskWithDueDate[] = [];

  for (const task of tasks) {
    if (task.dueDate < todayLocal) {
      overdue.push(task);
    } else if (task.dueDate === todayLocal) {
      today.push(task);
    } else if (task.dueDate <= upcomingCutoff) {
      upcoming.push(task);
    }
  }

  return { overdue, today, upcoming };
}
