// Pin the process's local timezone to Europe/Athens BEFORE any Date is
// constructed, so toLocalDateString's local-getter derivation is testable
// deterministically regardless of the machine/CI running this suite.
process.env.TZ = "Europe/Athens";

import { bucketTasksByDueDate } from "../src/services/taskBuckets";
import type { TaskWithDueDate } from "../src/types/tasks";

function mkTask(dueDate: string, overrides: Partial<TaskWithDueDate> = {}): TaskWithDueDate {
  return {
    id: `task-${dueDate}`,
    noteId: "n1",
    text: "Task",
    dueDate,
    dueTime: null,
    allDay: true,
    status: "open",
    calendarEventId: null,
    notificationId: null,
    createdAt: 0,
    noteSummary: "",
    notePeople: [],
    ...overrides,
  };
}

describe("bucketTasksByDueDate", () => {
  it("buckets a task due today", () => {
    const now = new Date("2026-07-08T10:00:00.000Z");
    const task = mkTask("2026-07-08");
    const { today, overdue, upcoming } = bucketTasksByDueDate([task], now);
    expect(today).toEqual([task]);
    expect(overdue).toEqual([]);
    expect(upcoming).toEqual([]);
  });

  it("buckets a task due yesterday as overdue", () => {
    const now = new Date("2026-07-08T10:00:00.000Z");
    const task = mkTask("2026-07-07");
    const { overdue, today, upcoming } = bucketTasksByDueDate([task], now);
    expect(overdue).toEqual([task]);
    expect(today).toEqual([]);
    expect(upcoming).toEqual([]);
  });

  it("includes a task due exactly 7 days out", () => {
    const now = new Date("2026-07-08T10:00:00.000Z");
    const task = mkTask("2026-07-15");
    const { upcoming } = bucketTasksByDueDate([task], now);
    expect(upcoming).toEqual([task]);
  });

  it("excludes a task due 8 days out", () => {
    const now = new Date("2026-07-08T10:00:00.000Z");
    const task = mkTask("2026-07-16");
    const { upcoming, overdue, today } = bucketTasksByDueDate([task], now);
    expect(upcoming).toEqual([]);
    expect(overdue).toEqual([]);
    expect(today).toEqual([]);
  });

  it("derives 'today' from the local Athens date, not the UTC date, for a late-night reference", () => {
    // 2026-07-08T22:30:00Z is 2026-07-09 01:30 in Athens (EEST, UTC+3 in July).
    const now = new Date("2026-07-08T22:30:00.000Z");

    // Guard: prove TZ pinning actually took effect in this Jest worker. If
    // process.env.TZ were silently ignored, local and UTC dates would match
    // and the rest of this test would pass vacuously instead of proving
    // anything.
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const utcDate = now.toISOString().slice(0, 10);
    expect(localDate).not.toBe(utcDate);
    expect(localDate).toBe("2026-07-09");
    expect(utcDate).toBe("2026-07-08");

    const localDayTask = mkTask("2026-07-09");
    const utcDayTask = mkTask("2026-07-08");
    const { today, overdue } = bucketTasksByDueDate([utcDayTask, localDayTask], now);

    expect(today).toEqual([localDayTask]);
    expect(overdue).toEqual([utcDayTask]);
  });

  it("computes the +7 day cutoff via local calendar arithmetic across the Europe/Athens DST fall-back", () => {
    // 2026-10-19T21:30:00Z is 2026-10-20 00:30 Athens local (EEST, UTC+3,
    // before the Oct 25 04:00 fall-back to EET/UTC+2). The correct calendar
    // cutoff is Oct 20 + 7 = Oct 27. A naive now.getTime() + 7*86400000
    // computation would land on 2026-10-26T23:30 local instead (the
    // intervening DST fall-back subtracts an hour), giving the wrong
    // calendar-day cutoff.
    const now = new Date("2026-10-19T21:30:00.000Z");
    expect(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`).toBe(
      "2026-10-20",
    );

    const onCutoff = mkTask("2026-10-27");
    const pastCutoff = mkTask("2026-10-28");
    const { upcoming } = bucketTasksByDueDate([onCutoff, pastCutoff], now);

    expect(upcoming).toEqual([onCutoff]);
  });

  it("preserves due_date ascending order within each bucket", () => {
    const now = new Date("2026-07-08T10:00:00.000Z");
    const early = mkTask("2026-07-09");
    const mid = mkTask("2026-07-10");
    const late = mkTask("2026-07-11");
    // Passed in already-ascending order, per getTasksWithDueDates' ORDER BY.
    const { upcoming } = bucketTasksByDueDate([early, mid, late], now);
    expect(upcoming.map((t) => t.dueDate)).toEqual(["2026-07-09", "2026-07-10", "2026-07-11"]);
  });
});
