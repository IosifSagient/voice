import { notesRepository } from "../src/services/notesRepository";
import { scheduleWidgetSync } from "../src/services/widgetSync";
import * as db from "../src/db";

jest.mock("../src/services/widgetSync", () => ({
  scheduleWidgetSync: jest.fn(),
}));

jest.mock("../src/db", () => {
  const names = [
    "saveNote",
    "getRecentNotes",
    "getAllNotes",
    "searchNotes",
    "searchNotesInRange",
    "searchNotesLiteral",
    "getNote",
    "deleteNote",
    "updateNote",
    "setActionCalendarEvent",
    "setActionNotificationId",
    "getActionItemsFiltered",
    "getNotesByDateRange",
    "getNotesByTag",
    "getRecentNotesByDays",
    "completeActionItem",
    "reopenActionItem",
    "deleteActionItem",
    "getTasksWithDueDates",
  ];
  return Object.fromEntries(names.map((name) => [name, jest.fn()]));
});

const mockSchedule = scheduleWidgetSync as jest.Mock;
const dbMock = db as unknown as Record<string, jest.Mock>;
const repo = notesRepository as unknown as Record<
  string,
  (...args: unknown[]) => Promise<unknown>
>;

const TASK_WRITES: [string, string, unknown[]][] = [
  ["create", "saveNote", [{ summary: "s" }, "transcript"]],
  ["save", "updateNote", [{ id: "n1" }]],
  ["delete", "deleteNote", ["n1"]],
  ["completeActionItem", "completeActionItem", ["a1"]],
  ["reopenActionItem", "reopenActionItem", ["a1"]],
  ["deleteActionItem", "deleteActionItem", ["a1"]],
];

const OTHER_METHODS: [string, string, unknown[]][] = [
  ["list", "getRecentNotes", []],
  ["listAll", "getAllNotes", []],
  ["search", "searchNotes", ["x"]],
  ["searchInRange", "searchNotesInRange", ["x", "a", "b"]],
  ["searchLiteral", "searchNotesLiteral", ["x"]],
  ["get", "getNote", ["n1"]],
  ["setCalendarEvent", "setActionCalendarEvent", ["a1", "e1"]],
  ["setNotificationId", "setActionNotificationId", ["a1", "x1"]],
  ["getActionItems", "getActionItemsFiltered", [{}]],
  ["getNotesByDateRange", "getNotesByDateRange", ["a", "b"]],
  ["getNotesByTag", "getNotesByTag", ["topic", "x"]],
  ["getRecentByDays", "getRecentNotesByDays", [7]],
  ["getTasksWithDueDates", "getTasksWithDueDates", []],
];

describe("notesRepository widget sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(TASK_WRITES)(
    "%s schedules a sync after success and returns the write's result",
    async (method, dbFn, args) => {
      const result = { from: dbFn };
      const write = (() => {
        let finish!: (value: unknown) => void;
        const promise = new Promise((res) => {
          finish = res;
        });
        return { promise, finish };
      })();
      dbMock[dbFn].mockReturnValue(write.promise);

      const pending = repo[method](...args);
      await Promise.resolve();
      expect(mockSchedule).not.toHaveBeenCalled();

      write.finish(result);
      await expect(pending).resolves.toBe(result);
      expect(dbMock[dbFn]).toHaveBeenCalledWith(...args);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    },
  );

  it.each(TASK_WRITES)(
    "%s rejects without scheduling a sync when the write fails",
    async (method, dbFn, args) => {
      const boom = new Error("write failed");
      dbMock[dbFn].mockRejectedValue(boom);

      await expect(repo[method](...args)).rejects.toBe(boom);
      expect(mockSchedule).not.toHaveBeenCalled();
    },
  );

  it.each(OTHER_METHODS)("%s does not schedule a sync", async (method, dbFn, args) => {
    dbMock[dbFn].mockResolvedValue(undefined);

    await repo[method](...args);
    expect(dbMock[dbFn]).toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("covers every repository method", () => {
    const covered = [...TASK_WRITES, ...OTHER_METHODS].map(([method]) => method).sort();
    expect(covered).toEqual(Object.keys(notesRepository).sort());
  });
});
