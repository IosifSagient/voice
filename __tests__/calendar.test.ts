import * as Calendar from 'expo-calendar';
import {
  getPermissionStatus,
  listWritableCalendars,
} from '../src/services/calendar';

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  getCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
}));

const mockGetPermissions = Calendar.getCalendarPermissionsAsync as jest.Mock;
const mockGetCalendars = Calendar.getCalendarsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('getPermissionStatus reflects granted status without prompting', async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });
  await expect(getPermissionStatus()).resolves.toBe(true);
});

test('getPermissionStatus reflects undetermined/denied status', async () => {
  mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
  await expect(getPermissionStatus()).resolves.toBe(false);
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
