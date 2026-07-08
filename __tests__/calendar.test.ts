import * as Calendar from 'expo-calendar';
import * as SecureStore from 'expo-secure-store';
import {
  getPermissionStatus,
  listWritableCalendars,
  addReminder,
  clearCachedCalendarId,
  isPreferredCalendarStale,
} from '../src/services/calendar';
import { setPreferredCalendarId } from '../src/services/calendarPrefs';

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  SourceType: { LOCAL: 'local' },
  CalendarAccessLevel: { OWNER: 'owner' },
  getCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  getSourcesAsync: jest.fn(),
  createCalendarAsync: jest.fn(),
  createEventAsync: jest.fn(),
  deleteEventAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockGetPermissions = Calendar.getCalendarPermissionsAsync as jest.Mock;
const mockGetCalendars = Calendar.getCalendarsAsync as jest.Mock;
const mockGetDefaultCalendar = Calendar.getDefaultCalendarAsync as jest.Mock;
const mockCreateEvent = Calendar.createEventAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  clearCachedCalendarId();
});

test('getPermissionStatus reflects granted status without prompting', async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: 'granted', canAskAgain: true });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: true, canAskAgain: true });
});

test('getPermissionStatus reflects undetermined/denied status', async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: false, canAskAgain: true });
});

// Write-only access is folded into 'denied' by expo-calendar's iOS wrapper and
// determined permissions report canAskAgain: false — the signal Settings UI
// uses to send the user to the OS Settings app instead of re-prompting.
test('getPermissionStatus surfaces canAskAgain: false for a determined denial (incl. write-only)', async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
  await expect(getPermissionStatus()).resolves.toEqual({ granted: false, canAskAgain: false });
});

test('listWritableCalendars filters to allowsModifications and maps fields', async () => {
  mockGetCalendars.mockResolvedValueOnce([
    {
      id: 'a',
      title: 'Personal',
      color: '#ff0000',
      allowsModifications: true,
      source: { name: 'iCloud' },
    },
    {
      id: 'b',
      title: 'Holidays',
      color: '#00ff00',
      allowsModifications: false,
      source: { name: 'iCloud' },
    },
  ]);

  await expect(listWritableCalendars()).resolves.toEqual([
    { id: 'a', title: 'Personal', accountName: 'iCloud', color: '#ff0000' },
  ]);
});

// Amendment 1: setPreferredCalendarId() must invalidate the warm resolution
// cache, otherwise addReminder() keeps writing to the previously resolved
// calendar for the rest of the process lifetime.
test('changing the preferred calendar invalidates a warm cache', async () => {
  mockGetItem.mockResolvedValue(null); // no preference set yet
  mockGetDefaultCalendar.mockResolvedValueOnce({ id: 'cal-A' });
  mockCreateEvent.mockResolvedValueOnce('event-1');

  const eventId1 = await addReminder({
    text: 'Call plumber',
    due_date: '2026-07-10',
    all_day: true,
  });
  expect(eventId1).toBe('event-1');
  expect(mockCreateEvent).toHaveBeenNthCalledWith(1, 'cal-A', expect.anything());

  // User picks calendar B in Settings.
  mockGetItem.mockResolvedValue('cal-B');
  mockGetCalendars.mockResolvedValueOnce([{ id: 'cal-B', allowsModifications: true }]);
  await setPreferredCalendarId('cal-B');

  mockCreateEvent.mockResolvedValueOnce('event-2');
  const eventId2 = await addReminder({
    text: 'Call plumber',
    due_date: '2026-07-11',
    all_day: true,
  });
  expect(eventId2).toBe('event-2');
  expect(mockCreateEvent).toHaveBeenNthCalledWith(2, 'cal-B', expect.anything());
});

// Amendment 3: a stale preferred calendar must fall back for that event only
// — the stored preference is left untouched so it recovers automatically if
// the calendar reappears (e.g. an Android account resyncs), with no re-pick.
test('a stale preferred calendar falls back without clearing the preference, and recovers automatically', async () => {
  mockGetItem.mockResolvedValue('cal-B'); // preference stays set to B throughout

  // First call: B no longer exists on the device.
  mockGetCalendars.mockResolvedValueOnce([{ id: 'cal-other', allowsModifications: true }]);
  mockGetDefaultCalendar.mockResolvedValueOnce({ id: 'cal-fallback' });
  mockCreateEvent.mockResolvedValueOnce('event-1');

  const eventId1 = await addReminder({ text: 'x', due_date: '2026-07-10', all_day: true });
  expect(eventId1).toBe('event-1');
  expect(mockCreateEvent).toHaveBeenNthCalledWith(1, 'cal-fallback', expect.anything());
  expect(isPreferredCalendarStale()).toBe(true);

  // B reappears — no re-pick happened, the preference was never cleared.
  mockGetCalendars.mockResolvedValueOnce([{ id: 'cal-B', allowsModifications: true }]);
  mockCreateEvent.mockResolvedValueOnce('event-2');

  const eventId2 = await addReminder({ text: 'y', due_date: '2026-07-11', all_day: true });
  expect(eventId2).toBe('event-2');
  expect(mockCreateEvent).toHaveBeenNthCalledWith(2, 'cal-B', expect.anything());
  expect(isPreferredCalendarStale()).toBe(false);
});
