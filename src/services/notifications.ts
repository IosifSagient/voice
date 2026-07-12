import * as Notifications from "expo-notifications";
import {
  REMINDER_OFFSET_MINUTES,
  DATE_ONLY_REMINDER_HOUR,
} from "../config/notifications";

// Must run before any notification could arrive, including a cold start —
// so it's a module-scope call, not something invoked from a hook/effect.
// Importing this file once (from App.tsx) is enough to register it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type CalendarPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getPermissionStatus(): Promise<CalendarPermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted: status === "granted", canAskAgain };
}

export async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

type ReminderItem = {
  text: string;
  due_date: string | null;
  due_time?: string | null;
  all_day?: boolean;
};

// R2/R3/R4: computes the local instant the reminder should fire at, or null
// if there's nothing to schedule (no due_date) or the computed time has
// already passed (never schedule into the past — no immediate-fire fallback).
//
// Date-only branch uses the LOCAL Date constructor, not Date.UTC — due_date
// is a timezone-invariant YYYY-MM-DD label (see parseDueDate/db.js), and R2
// wants 09:00 in the user's local time. calendar.ts's all-day-event branch
// uses Date.UTC for an unrelated reason (mapping to the right day in the
// device's native calendar provider) — do not copy that pattern here, it
// would fire at 09:00 UTC instead of 09:00 local.
export function computeFireTime(
  item: ReminderItem,
  now: Date = new Date(),
): Date | null {
  if (!item.due_date) return null;
  const [y, m, d] = item.due_date.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;

  const isTimed = item.all_day !== true && !!item.due_time;
  let fireTime: Date;
  if (isTimed) {
    const [hh, mm] = item.due_time!.split(":").map(Number);
    fireTime = new Date(y, m - 1, d, hh, mm, 0, 0);
    fireTime = new Date(fireTime.getTime() - REMINDER_OFFSET_MINUTES * 60000);
  } else {
    fireTime = new Date(y, m - 1, d, DATE_ONLY_REMINDER_HOUR, 0, 0, 0);
  }

  if (fireTime.getTime() <= now.getTime()) return null;
  return fireTime;
}

function relativeBody(item: ReminderItem, now: Date = new Date()): string {
  if (item.due_time && item.all_day !== true) {
    return `Στις ${item.due_time}`;
  }
  const [y, m, d] = item.due_date!.slice(0, 10).split("-").map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((dueLocal.getTime() - todayLocal.getTime()) / 86400000);
  if (dayDiff === 0) return "Σήμερα";
  if (dayDiff === 1) return "Αύριο";
  return "Σήμερα"; // fire time is always today-or-future relative to `now` (R4), so this is unreachable in practice
}

// Never throws — a denied/undetermined permission or an unschedulable item
// (R3/R4) silently no-ops and returns null, so callers never need to guard
// task creation against notification failures.
export async function scheduleReminder(item: ReminderItem): Promise<string | null> {
  const fireTime = computeFireTime(item);
  if (!fireTime) return null;

  const { granted } = await getPermissionStatus();
  if (!granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title: item.text, body: relativeBody(item) },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireTime,
    },
  });
}

export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already fired/cancelled or unknown id — ignore, mirrors calendar.ts's removeReminder
  }
}
