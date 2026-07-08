import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { CalendarOption } from '../types/calendar';
import { getPreferredCalendarId } from './calendarPrefs';

let cachedCalendarId: string | null = null;
let preferredCalendarStale = false;

// True when the user has a preferred calendar set but it no longer exists on
// the device (e.g. an Android account was removed) — surfaced so Settings UI
// can prompt for a re-pick. Clears itself as soon as the calendar is valid
// again (e.g. the account resyncs) without requiring any user action.
export function isPreferredCalendarStale(): boolean {
  return preferredCalendarStale;
}

export async function ensurePermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// Checks current permission without prompting — for UI that needs to show a
// "grant access" state and request only on explicit user interaction.
export async function getPermissionStatus(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

// Called by calendarPrefs.setPreferredCalendarId() whenever the user changes
// their preferred calendar, so a stale resolution isn't reused for the rest
// of the process lifetime.
export function clearCachedCalendarId(): void {
  cachedCalendarId = null;
}

// Assumes ensurePermission() was already called and granted.
export async function listWritableCalendars(): Promise<CalendarOption[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars
    .filter((c) => c.allowsModifications)
    .map((c) => ({
      id: c.id,
      title: c.title,
      accountName: c.source.name,
      color: c.color,
    }));
}

// `cache` is false when resolving a one-off fallback for a stale preferred
// calendar — caching that result would mask the preference becoming valid
// again on a later call (see getOrCreateCalendarId).
async function resolveDefaultCalendarId(cache: boolean): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    if (cache) cachedCalendarId = cal.id;
    return cal.id;
  }

  // Android — find any calendar that allows modification
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  if (writable) {
    if (cache) cachedCalendarId = writable.id;
    return writable.id;
  }

  // Fallback: create a local VoiceNote calendar
  try {
    const sources = await Calendar.getSourcesAsync();
    const local = sources.find(
      (s) => s.type === Calendar.SourceType.LOCAL || s.type === ('local' as string)
    );
    const id = await Calendar.createCalendarAsync({
      title: 'VoiceNote',
      color: '#2DD4BF',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: local?.id,
      source: local ?? { isLocalAccount: true, name: 'VoiceNote', type: Calendar.SourceType.LOCAL },
      name: 'voicenote',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    if (cache) cachedCalendarId = id;
    return id;
  } catch {
    return null;
  }
}

async function getOrCreateCalendarId(): Promise<string | null> {
  if (cachedCalendarId) return cachedCalendarId;

  const preferredId = await getPreferredCalendarId();
  if (preferredId) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.some((c) => c.id === preferredId)) {
      preferredCalendarStale = false;
      cachedCalendarId = preferredId;
      return preferredId;
    }

    // Preferred calendar is gone (e.g. an Android account was removed). Fall
    // back for this event only — deliberately not cached and the stored
    // preference is left untouched, so if the calendar reappears (account
    // resync) it's picked up again automatically without a re-pick.
    preferredCalendarStale = true;
    return resolveDefaultCalendarId(false);
  }

  preferredCalendarStale = false;
  return resolveDefaultCalendarId(true);
}

// Assumes ensurePermission() was already called and granted.
export async function addReminder(actionItem: {
  text: string;
  due_date: string;
  due_time?: string | null;
  all_day?: boolean;
}): Promise<string | null> {
  const calendarId = await getOrCreateCalendarId();
  if (!calendarId) return null;

  const isAllDay = actionItem.all_day !== false || !actionItem.due_time;

  if (!isAllDay && actionItem.due_time) {
    // Timed event — device interprets local datetime in its own timezone (Europe/Athens for users)
    const startDate = new Date(`${actionItem.due_date}T${actionItem.due_time}:00`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1h
    return Calendar.createEventAsync(calendarId, {
      title: actionItem.text,
      startDate,
      endDate,
      allDay: false,
      alarms: [{ relativeOffset: -60 }], // 1h before timed event
    });
  }

  // All-day event — use UTC midnight so the native calendar provider maps to the right date.
  // Constructing with T00:00:00 (no offset) would be local midnight, which for UTC+ devices
  // shifts to the previous day in UTC and causes the event to land one day early.
  const [y, m, d] = actionItem.due_date.split('-').map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d));
  const endDate = new Date(Date.UTC(y, m - 1, d + 1));
  return Calendar.createEventAsync(calendarId, {
    title: actionItem.text,
    startDate,
    endDate,
    allDay: true,
    alarms: [{ relativeOffset: -60 * 24 }], // 24h before all-day event
  });
}

export async function removeReminder(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // already deleted or not found — ignore
  }
}
