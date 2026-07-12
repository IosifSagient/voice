import { useCallback, useEffect, useState } from "react";
import {
  ensurePermission,
  getPermissionStatus,
  scheduleReminder,
  cancelReminder,
} from "../services/notifications";
import { notesRepository } from "../services/notesRepository";
import type { TaskWithContext } from "../types/tasks";

// Schedules a reminder for every open, due-dated action item that doesn't
// have one yet — i.e. it was created while permission was denied/undetermined
// (scheduleReminder silently no-ops in that case, per the automatic-scheduling
// design). Called once right after permission is newly granted. Skips items
// whose due date has since passed (scheduleReminder's own R4 check).
export async function rescheduleMissingNotifications(): Promise<void> {
  const items: TaskWithContext[] = await notesRepository.getActionItems({ status: "open" });
  const missing = items.filter((i) => i.dueDate && !i.notificationId);
  for (const item of missing) {
    const notificationId = await scheduleReminder({
      text: item.text,
      due_date: item.dueDate,
      due_time: item.dueTime,
      all_day: item.allDay,
    });
    if (notificationId) {
      try {
        await notesRepository.setNotificationId(item.id, notificationId);
      } catch {
        await cancelReminder(notificationId);
      }
    }
  }
}

// Backs the Settings notifications row: permission state (checked without
// prompting) and a request action. Mirrors useCalendarSettings's shape —
// no calendar-list equivalent needed here.
export function useNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { granted, canAskAgain: askAgain } = await getPermissionStatus();
    setPermissionGranted(granted);
    setCanAskAgain(askAgain);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await ensurePermission();
    if (granted) {
      await rescheduleMissingNotifications();
    }
    // Refresh either way — a denial also updates canAskAgain, since iOS
    // marks the permission as determined and won't prompt again.
    await refresh();
    return granted;
  }, [refresh]);

  return { loading, permissionGranted, canAskAgain, requestPermission };
}
