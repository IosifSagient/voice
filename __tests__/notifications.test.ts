process.env.TZ = "Europe/Athens";

import * as Notifications from "expo-notifications";
import {
  getPermissionStatus,
  ensurePermission,
  scheduleReminder,
  cancelReminder,
  handleInitialNotification,
  computeFireTime,
} from "../src/services/notifications";
import { navigationRef } from "../src/lib/navigationRef";
import {
  REMINDER_OFFSET_MINUTES,
  DATE_ONLY_REMINDER_HOUR,
} from "../src/config/notifications";

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(),
}));

jest.mock("../src/lib/navigationRef", () => ({
  navigationRef: {
    isReady: jest.fn(),
    navigate: jest.fn(),
  },
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockGetLastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockIsReady = navigationRef.isReady as jest.Mock;
const mockNavigate = navigationRef.navigate as jest.Mock;

// The module registers this exactly once, at import time, before any
// beforeEach's jest.resetAllMocks() below clears the mock's call history —
// capture the real handler reference here, at module-eval time, so the live-
// tap test further down can invoke the same function the app actually wires up.
const mockAddResponseListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
const registeredResponseHandler = mockAddResponseListener.mock.calls[0][0] as (
  response: Notifications.NotificationResponse | null,
) => void;

function mkResponse(data: unknown) {
  return { notification: { request: { content: { data } } } } as Notifications.NotificationResponse;
}

beforeEach(() => {
  jest.resetAllMocks();
});

test("getPermissionStatus reflects granted status without prompting", async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: true, canAskAgain: true });
});

test("getPermissionStatus reflects undetermined/denied status", async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: "undetermined", canAskAgain: true });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: false, canAskAgain: true });
});

test("getPermissionStatus surfaces canAskAgain: false for a determined denial", async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: "denied", canAskAgain: false });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: false, canAskAgain: false });
});

test("ensurePermission returns true when the user grants", async () => {
  mockRequestPermissions.mockResolvedValueOnce({ status: "granted" });
  await expect(ensurePermission()).resolves.toBe(true);
});

test("ensurePermission returns false when the user denies", async () => {
  mockRequestPermissions.mockResolvedValueOnce({ status: "denied" });
  await expect(ensurePermission()).resolves.toBe(false);
});

describe("scheduleReminder — never throws, no-ops per R3/R4/denied-permission", () => {
  it("returns null and never calls the OS scheduling API when there is no due_date", async () => {
    const result = await scheduleReminder({ text: "x", due_date: null, note_id: "n1", task_id: "t1" });
    expect(result).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("returns null and never calls the OS scheduling API when the due date is in the past", async () => {
    const result = await scheduleReminder({ text: "x", due_date: "2020-01-01", note_id: "n1", task_id: "t1" });
    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("returns null without throwing when permission is not granted — task creation must never be blocked", async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: "denied", canAskAgain: false });
    await expect(
      scheduleReminder({ text: "x", due_date: "2099-06-15", note_id: "n1", task_id: "t1" }),
    ).resolves.toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("schedules with the item's text as title, a DATE trigger, and the noteId/taskId data payload when granted and in the future", async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
    mockSchedule.mockResolvedValueOnce("notif-1");

    const result = await scheduleReminder({
      text: "Πάρε τηλέφωνο τον Γιάννη",
      due_date: "2099-06-15",
      note_id: "note-42",
      task_id: "task-7",
    });

    expect(result).toBe("notif-1");
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Πάρε τηλέφωνο τον Γιάννη",
          data: { noteId: "note-42", taskId: "task-7" },
        }),
        trigger: expect.objectContaining({ type: "date" }),
      }),
    );
  });
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toDueDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toDueTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe("computeFireTime — R1 clamp for near-future timed reminders", () => {
  const now = new Date(2099, 5, 15, 10, 0, 0, 0);

  it("clamps to the due instant when due < offset (10min) away — 8 minutes out", () => {
    const due = new Date(now.getTime() + 8 * 60000);
    const fireTime = computeFireTime(
      { text: "x", due_date: toDueDate(due), due_time: toDueTime(due) },
      now,
    );
    expect(fireTime).not.toBeNull();
    expect(fireTime!.getTime()).toBe(due.getTime());
  });

  it("uses the normal offset when due >= offset away — 15 minutes out", () => {
    const due = new Date(now.getTime() + 15 * 60000);
    const fireTime = computeFireTime(
      { text: "x", due_date: toDueDate(due), due_time: toDueTime(due) },
      now,
    );
    expect(fireTime).not.toBeNull();
    expect(fireTime!.getTime()).toBe(due.getTime() - REMINDER_OFFSET_MINUTES * 60000);
  });

  it("still skips (null) when the due instant itself is already past — 2 minutes ago", () => {
    const due = new Date(now.getTime() - 2 * 60000);
    const fireTime = computeFireTime(
      { text: "x", due_date: toDueDate(due), due_time: toDueTime(due) },
      now,
    );
    expect(fireTime).toBeNull();
  });

  it("leaves the date-only 09:00 rule unchanged for a future all-day task", () => {
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const fireTime = computeFireTime(
      { text: "x", due_date: toDueDate(due), due_time: null, all_day: true },
      now,
    );
    expect(fireTime).not.toBeNull();
    expect(fireTime!.getHours()).toBe(DATE_ONLY_REMINDER_HOUR);
    expect(fireTime!.getMinutes()).toBe(0);
  });
});

describe("cancelReminder", () => {
  it("cancels the given notification id", async () => {
    await cancelReminder("notif-1");
    expect(mockCancel).toHaveBeenCalledWith("notif-1");
  });

  it("swallows a rejection (already-fired/unknown id) without throwing", async () => {
    mockCancel.mockRejectedValueOnce(new Error("not found"));
    await expect(cancelReminder("gone")).resolves.not.toThrow();
  });
});

describe("handleInitialNotification — cold-start tap routing", () => {
  it("routes to NoteDetail when the launch response carries a string noteId and the navigator is ready", async () => {
    mockGetLastResponse.mockResolvedValueOnce(mkResponse({ noteId: "n1", taskId: "t1" }));
    mockIsReady.mockReturnValue(true);

    await handleInitialNotification();

    expect(mockNavigate).toHaveBeenCalledWith("NoteDetail", { id: "n1" });
  });

  it("no-ops when there was no launch notification this session", async () => {
    mockGetLastResponse.mockResolvedValueOnce(null);
    mockIsReady.mockReturnValue(true);

    await handleInitialNotification();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("no-ops when noteId is missing from the payload (older notifications scheduled before this payload existed)", async () => {
    mockGetLastResponse.mockResolvedValueOnce(mkResponse(undefined));
    mockIsReady.mockReturnValue(true);

    await handleInitialNotification();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("no-ops when noteId is present but not a string", async () => {
    mockGetLastResponse.mockResolvedValueOnce(mkResponse({ noteId: 42 }));
    mockIsReady.mockReturnValue(true);

    await handleInitialNotification();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("no-ops when the navigator isn't ready yet, even with a valid payload", async () => {
    mockGetLastResponse.mockResolvedValueOnce(mkResponse({ noteId: "n1" }));
    mockIsReady.mockReturnValue(false);

    await handleInitialNotification();

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("addNotificationResponseReceivedListener — live tap routing (foreground/background)", () => {
  it("routes the same way as the cold-start path for a tap while the app is already running", () => {
    mockIsReady.mockReturnValue(true);

    registeredResponseHandler(mkResponse({ noteId: "n2", taskId: "t2" }));

    expect(mockNavigate).toHaveBeenCalledWith("NoteDetail", { id: "n2" });
  });

  it("no-ops for a live tap with a missing noteId", () => {
    mockIsReady.mockReturnValue(true);

    registeredResponseHandler(mkResponse(undefined));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("no-ops for a live tap when the navigator isn't ready", () => {
    mockIsReady.mockReturnValue(false);

    registeredResponseHandler(mkResponse({ noteId: "n2" }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
