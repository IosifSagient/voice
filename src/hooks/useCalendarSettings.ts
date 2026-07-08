import { useCallback, useEffect, useState } from "react";
import {
  ensurePermission,
  getPermissionStatus,
  listWritableCalendars,
} from "../services/calendar";
import {
  getPreferredCalendarId,
  setPreferredCalendarId,
} from "../services/calendarPrefs";
import type { CalendarOption } from "../types/calendar";

// Backs the Settings calendar picker: permission state (checked without
// prompting), the writable calendars to choose from, and the current
// selection. Mirrors useAppLock's shape (state + a setter that persists).
export function useCalendarSettings() {
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rePickNeeded, setRePickNeeded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const granted = await getPermissionStatus();
    setPermissionGranted(granted);

    if (!granted) {
      setCalendars([]);
      setSelectedId(null);
      setRePickNeeded(false);
      setLoading(false);
      return;
    }

    const [list, preferredId] = await Promise.all([
      listWritableCalendars(),
      getPreferredCalendarId(),
    ]);
    setCalendars(list);
    setSelectedId(preferredId);
    setRePickNeeded(preferredId !== null && !list.some((c) => c.id === preferredId));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await ensurePermission();
    if (granted) {
      await refresh();
    } else {
      setPermissionGranted(false);
    }
    return granted;
  }, [refresh]);

  const selectCalendar = useCallback(async (id: string): Promise<void> => {
    await setPreferredCalendarId(id);
    setSelectedId(id);
    setRePickNeeded(false);
  }, []);

  return {
    loading,
    permissionGranted,
    calendars,
    selectedId,
    rePickNeeded,
    requestPermission,
    selectCalendar,
  };
}
