// Pin the process's local timezone to Europe/Athens BEFORE any Date is
// constructed, matching taskBuckets.test.ts's convention — computeFireTime's
// local-getter/constructor derivation is only testable deterministically if
// the machine/CI running this suite can't silently use a different zone.
process.env.TZ = "Europe/Athens";

// computeFireTime is pure and never touches the Notifications API, but
// importing the real module pulls in expo-notifications' own top-level
// push-token-registration side effect, which logs an "Expo Go push removed
// in SDK 53" console.warn on every run. Mock it out (same shape as
// notifications.test.ts) so this file never loads the real module.
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

import { computeFireTime } from "../src/services/notifications";

describe("computeFireTime — R3 (no due_date)", () => {
  it("returns null when due_date is null", () => {
    expect(computeFireTime({ text: "x", due_date: null })).toBeNull();
  });
});

describe("computeFireTime — R2 (date-only, 09:00 local)", () => {
  it("fires at 09:00 in LOCAL time, not UTC", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00 local, well before the due date
    const result = computeFireTime({ text: "x", due_date: "2026-06-15" }, now);
    expect(result).not.toBeNull();
    // Local hour must be 9. Athens is UTC+2/UTC+3, so the UTC hour is 6 or 7 —
    // asserting it's NOT 9 catches an accidental Date.UTC(...) construction,
    // which is the exact bug calendar.ts's (unrelated) all-day-event branch
    // would introduce if copied here by reflex.
    expect(result!.getHours()).toBe(9);
    expect(result!.getUTCHours()).not.toBe(9);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(5); // June, 0-indexed
    expect(result!.getDate()).toBe(15);
  });

  it("all_day: true with a due_time set still uses the 09:00 date-only path", () => {
    const now = new Date(2026, 0, 1);
    const result = computeFireTime(
      { text: "x", due_date: "2026-06-15", due_time: "14:00", all_day: true },
      now,
    );
    expect(result!.getHours()).toBe(9);
  });
});

describe("computeFireTime — R1 (timed, offset before start)", () => {
  it("fires REMINDER_OFFSET_MINUTES (10) before the due_time", () => {
    const now = new Date(2026, 0, 1);
    const result = computeFireTime(
      { text: "x", due_date: "2026-06-15", due_time: "14:00", all_day: false },
      now,
    );
    expect(result!.getHours()).toBe(13);
    expect(result!.getMinutes()).toBe(50);
  });
});

describe("computeFireTime — R4 (never schedule into the past)", () => {
  it("skips a date-only task due today when now is already past 09:00", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0); // 10:00 local, past the 09:00 fire time
    const result = computeFireTime({ text: "x", due_date: "2026-06-15" }, now);
    expect(result).toBeNull();
  });

  it("schedules a date-only task due today when now is still before 09:00", () => {
    const now = new Date(2026, 5, 15, 8, 0, 0);
    const result = computeFireTime({ text: "x", due_date: "2026-06-15" }, now);
    expect(result).not.toBeNull();
  });

  it("skips a timed task whose offset-adjusted fire time has already passed", () => {
    // due_time 14:00, offset -10min => fires at 13:50. `now` is 13:55 — already past.
    const now = new Date(2026, 5, 15, 13, 55, 0);
    const result = computeFireTime(
      { text: "x", due_date: "2026-06-15", due_time: "14:00", all_day: false },
      now,
    );
    expect(result).toBeNull();
  });

  it("does not skip silently-in-the-future edge case: fires exactly at the offset boundary minus one tick", () => {
    const now = new Date(2026, 5, 15, 13, 49, 59, 999);
    const result = computeFireTime(
      { text: "x", due_date: "2026-06-15", due_time: "14:00", all_day: false },
      now,
    );
    expect(result).not.toBeNull();
  });
});

describe("computeFireTime — DST transitions (Europe/Athens 2026)", () => {
  // Athens springs forward on Sun 2026-03-29 (02:00 -> 03:00 local skipped)
  // and falls back on Sun 2026-10-25 (04:00 -> 03:00 local repeated). A
  // fixed-millis implementation (date.getTime() + N*86400000) would land on
  // the wrong wall-clock hour on the day after either transition; the local
  // Date-component construction this function uses must not.
  it("date-only reminder due the day AFTER spring-forward still fires at 09:00 local", () => {
    const now = new Date(2026, 2, 25);
    const result = computeFireTime({ text: "x", due_date: "2026-03-30" }, now);
    expect(result!.getHours()).toBe(9);
    expect(result!.getDate()).toBe(30);
    expect(result!.getMonth()).toBe(2);
  });

  it("date-only reminder due ON the spring-forward day itself still fires at 09:00 local", () => {
    const now = new Date(2026, 2, 25);
    const result = computeFireTime({ text: "x", due_date: "2026-03-29" }, now);
    expect(result!.getHours()).toBe(9);
    expect(result!.getDate()).toBe(29);
  });

  it("date-only reminder due the day AFTER fall-back still fires at 09:00 local", () => {
    const now = new Date(2026, 9, 20);
    const result = computeFireTime({ text: "x", due_date: "2026-10-26" }, now);
    expect(result!.getHours()).toBe(9);
    expect(result!.getDate()).toBe(26);
    expect(result!.getMonth()).toBe(9);
  });

  it("date-only reminder due ON the fall-back day itself still fires at 09:00 local", () => {
    const now = new Date(2026, 9, 20);
    const result = computeFireTime({ text: "x", due_date: "2026-10-25" }, now);
    expect(result!.getHours()).toBe(9);
    expect(result!.getDate()).toBe(25);
  });

  it("a timed reminder crossing spring-forward keeps the correct offset in wall-clock time", () => {
    const now = new Date(2026, 2, 25);
    const result = computeFireTime(
      { text: "x", due_date: "2026-03-30", due_time: "14:00", all_day: false },
      now,
    );
    expect(result!.getHours()).toBe(13);
    expect(result!.getMinutes()).toBe(50);
    expect(result!.getDate()).toBe(30);
  });
});
