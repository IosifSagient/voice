import { clearWidget, scheduleWidgetSync } from "../src/services/widgetSync";
import { reloadTasksWidget, writeSnapshotString } from "../src/lib/widgetBridge";
import { countOpenActionItems, getOpenActionItemsForWidget } from "../src/db";

jest.mock("../src/lib/widgetBridge", () => ({
  writeSnapshotString: jest.fn(),
  reloadTasksWidget: jest.fn(),
}));

jest.mock("../src/db", () => ({
  countOpenActionItems: jest.fn(),
  getOpenActionItemsForWidget: jest.fn(),
}));

const mockWrite = writeSnapshotString as jest.Mock;
const mockReload = reloadTasksWidget as jest.Mock;
const mockCount = countOpenActionItems as jest.Mock;
const mockRows = getOpenActionItemsForWidget as jest.Mock;

const TASK = {
  id: "a1",
  text: "Call the dentist",
  dueDate: "2026-11-02",
  dueTime: "09:30",
  allDay: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const lastWritten = () => JSON.parse(mockWrite.mock.calls.at(-1)![0]);

describe("widgetSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCount.mockResolvedValue(4);
    mockRows.mockResolvedValue([TASK]);
  });

  afterEach(async () => {
    clearWidget();
    await jest.runOnlyPendingTimersAsync();
    jest.useRealTimers();
  });

  it("coalesces a burst into one write and one reload", async () => {
    for (let i = 0; i < 5; i++) scheduleWidgetSync();

    await jest.advanceTimersByTimeAsync(299);
    expect(mockWrite).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("restarts the debounce on each call", async () => {
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(200);
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(200);
    expect(mockWrite).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(100);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("writes a string that parses into a valid v1 snapshot", async () => {
    jest.setSystemTime(new Date("2026-10-31T10:00:00.000Z"));
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);

    expect(typeof mockWrite.mock.calls[0][0]).toBe("string");
    expect(lastWritten()).toEqual({
      version: 1,
      generatedAt: Date.parse("2026-10-31T10:00:00.300Z"),
      openCount: 4,
      tasks: [TASK],
    });
  });

  it("reloads only after writing", async () => {
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);

    expect(mockWrite.mock.invocationCallOrder[0]).toBeLessThan(
      mockReload.mock.invocationCallOrder[0],
    );
  });

  it("logs a load failure without throwing or writing", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("db down");
    mockCount.mockRejectedValue(boom);

    expect(() => scheduleWidgetSync()).not.toThrow();
    await jest.advanceTimersByTimeAsync(300);

    expect(errorSpy).toHaveBeenCalledWith("[widgetSync:runSync] sync failed", boom);
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("clearWidget writes an empty v1 snapshot and reloads immediately", () => {
    clearWidget();

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(lastWritten()).toMatchObject({ version: 1, openCount: 0, tasks: [] });
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("clearWidget cancels a pending sync", async () => {
    scheduleWidgetSync();
    clearWidget();
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockCount).not.toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(lastWritten().openCount).toBe(0);
  });

  it("a load in flight during clearWidget can't refill the widget", async () => {
    const count = deferred<number>();
    mockCount.mockReturnValueOnce(count.promise);

    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);
    clearWidget();
    count.resolve(4);
    await jest.advanceTimersByTimeAsync(0);

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(lastWritten().openCount).toBe(0);
  });

  it("a slow older load can't overwrite a newer sync", async () => {
    const slow = deferred<number>();
    mockCount.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(2);

    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);
    slow.resolve(9);
    await jest.advanceTimersByTimeAsync(0);

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(lastWritten().openCount).toBe(2);
  });

  it("can sync again after a clear (sign-in refills)", async () => {
    clearWidget();
    scheduleWidgetSync();
    await jest.advanceTimersByTimeAsync(300);

    expect(lastWritten().openCount).toBe(4);
  });

  it("is a no-op when the native module is missing", async () => {
    jest.resetModules();
    jest.dontMock("../src/lib/widgetBridge");
    jest.doMock("@bacons/apple-targets", () => {
      throw new ReferenceError("expo is not defined");
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const freshDb = require("../src/db");
    freshDb.countOpenActionItems.mockResolvedValue(4);
    freshDb.getOpenActionItemsForWidget.mockResolvedValue([TASK]);
    const sync = require("../src/services/widgetSync");

    expect(() => sync.scheduleWidgetSync()).not.toThrow();
    await jest.advanceTimersByTimeAsync(300);
    expect(() => sync.clearWidget()).not.toThrow();

    expect(freshDb.countOpenActionItems).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
