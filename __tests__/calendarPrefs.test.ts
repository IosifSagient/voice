import * as SecureStore from 'expo-secure-store';
import {
  getPreferredCalendarId,
  setPreferredCalendarId,
} from '../src/services/calendarPrefs';
import { clearCachedCalendarId } from '../src/services/calendar';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../src/services/calendar', () => ({
  clearCachedCalendarId: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockClearCache = clearCachedCalendarId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('getPreferredCalendarId reads the stored key', async () => {
  mockGetItem.mockResolvedValueOnce('cal-123');
  await expect(getPreferredCalendarId()).resolves.toBe('cal-123');
  expect(mockGetItem).toHaveBeenCalledWith('preferred_calendar_id');
});

test('getPreferredCalendarId returns null when nothing stored', async () => {
  mockGetItem.mockResolvedValueOnce(null);
  await expect(getPreferredCalendarId()).resolves.toBeNull();
});

test('setPreferredCalendarId persists the id and clears the cache', async () => {
  await setPreferredCalendarId('cal-456');
  expect(mockSetItem).toHaveBeenCalledWith('preferred_calendar_id', 'cal-456');
  expect(mockClearCache).toHaveBeenCalledTimes(1);
});

test('setPreferredCalendarId(null) deletes the stored key and clears the cache', async () => {
  await setPreferredCalendarId(null);
  expect(mockDeleteItem).toHaveBeenCalledWith('preferred_calendar_id');
  expect(mockClearCache).toHaveBeenCalledTimes(1);
});
