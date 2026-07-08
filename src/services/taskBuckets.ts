import type { TaskWithDueDate, TaskBuckets } from "../types/tasks";

// Local (device-timezone) YYYY-MM-DD, from Date getters — not toISOString(),
// which would give the UTC date and drift from the user's actual calendar
// day near midnight.
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
