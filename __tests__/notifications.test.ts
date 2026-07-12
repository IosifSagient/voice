process.env.TZ = "Europe/Athens";

import * as Notifications from "expo-notifications";
import {
  getPermissionStatus,
  ensurePermission,
  scheduleReminder,
  cancelReminder,
} from "../src/services/notifications";

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

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
    const result = await scheduleReminder({ text: "x", due_date: null });
    expect(result).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("returns null and never calls the OS scheduling API when the due date is in the past", async () => {
    const result = await scheduleReminder({ text: "x", due_date: "2020-01-01" });
    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("returns null without throwing when permission is not granted — task creation must never be blocked", async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: "denied", canAskAgain: false });
    await expect(
      scheduleReminder({ text: "x", due_date: "2099-06-15" }),
    ).resolves.toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("schedules with the item's text as title and a DATE trigger when granted and in the future", async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
    mockSchedule.mockResolvedValueOnce("notif-1");

    const result = await scheduleReminder({ text: "Πάρε τηλέφωνο τον Γιάννη", due_date: "2099-06-15" });

    expect(result).toBe("notif-1");
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "Πάρε τηλέφωνο τον Γιάννη" }),
        trigger: expect.objectContaining({ type: "date" }),
      }),
    );
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
