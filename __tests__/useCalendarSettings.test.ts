import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCalendarSettings } from '../src/hooks/useCalendarSettings';
import {
  ensurePermission,
  getPermissionStatus,
  listWritableCalendars,
} from '../src/services/calendar';
import {
  getPreferredCalendarId,
  setPreferredCalendarId,
} from '../src/services/calendarPrefs';
import type { CalendarOption } from '../src/types/calendar';

jest.mock('../src/services/calendar', () => ({
  ensurePermission: jest.fn(),
  getPermissionStatus: jest.fn(),
  listWritableCalendars: jest.fn(),
}));

jest.mock('../src/services/calendarPrefs', () => ({
  getPreferredCalendarId: jest.fn(),
  setPreferredCalendarId: jest.fn(),
}));

const mockEnsurePermission = ensurePermission as jest.Mock;
const mockGetPermissionStatus = getPermissionStatus as jest.Mock;
const mockListWritableCalendars = listWritableCalendars as jest.Mock;
const mockGetPreferredCalendarId = getPreferredCalendarId as jest.Mock;
const mockSetPreferredCalendarId = setPreferredCalendarId as jest.Mock;

const CAL_A: CalendarOption = { id: 'a', title: 'Personal', accountName: 'iCloud', color: '#f00' };
const CAL_B: CalendarOption = { id: 'b', title: 'Work', accountName: 'Work', color: '#0f0' };

// Manual render-hook helper — no @testing-library/react-hooks is installed.
async function renderUseCalendarSettings() {
  let hookResult!: ReturnType<typeof useCalendarSettings>;
  function TestComponent() {
    hookResult = useCalendarSettings();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return {
    getResult: () => hookResult,
    rerender: async () => {
      await act(async () => {
        renderer.update(React.createElement(TestComponent));
      });
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useCalendarSettings — no permission', () => {
  it('exposes permissionGranted false and an empty calendar list without calling listWritableCalendars', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: false, canAskAgain: true });
    const { getResult } = await renderUseCalendarSettings();

    expect(getResult().loading).toBe(false);
    expect(getResult().permissionGranted).toBe(false);
    expect(getResult().calendars).toEqual([]);
    expect(getResult().rePickNeeded).toBe(false);
    expect(mockListWritableCalendars).not.toHaveBeenCalled();
  });

  it('requestPermission() grants access and refreshes the calendar list', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true }); // initial load, before granting
    const { getResult } = await renderUseCalendarSettings();

    mockEnsurePermission.mockResolvedValueOnce(true);
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: true, canAskAgain: true }); // refresh() re-checks after granting
    mockListWritableCalendars.mockResolvedValueOnce([CAL_A]);
    mockGetPreferredCalendarId.mockResolvedValueOnce(null);

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().permissionGranted).toBe(true);
    expect(getResult().calendars).toEqual([CAL_A]);
  });

  it('requestPermission() stays ungranted when the user declines', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true }); // initial load
    const { getResult } = await renderUseCalendarSettings();

    mockEnsurePermission.mockResolvedValueOnce(false);
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true }); // refresh() re-checks after declining

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().permissionGranted).toBe(false);
    expect(getResult().calendars).toEqual([]);
  });

  it('canAskAgain starts true and flips to false once iOS determines the permission (denial or write-only) and won\'t re-prompt', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true }); // initial load
    const { getResult } = await renderUseCalendarSettings();
    expect(getResult().canAskAgain).toBe(true);

    mockEnsurePermission.mockResolvedValueOnce(false);
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: false }); // refresh() after the OS prompt was consumed

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().permissionGranted).toBe(false);
    expect(getResult().canAskAgain).toBe(false);
  });
});

describe('useCalendarSettings — permission already granted', () => {
  it('loads calendars and the current selection', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: true });
    mockListWritableCalendars.mockResolvedValue([CAL_A, CAL_B]);
    mockGetPreferredCalendarId.mockResolvedValue('b');

    const { getResult } = await renderUseCalendarSettings();

    expect(getResult().permissionGranted).toBe(true);
    expect(getResult().calendars).toEqual([CAL_A, CAL_B]);
    expect(getResult().selectedId).toBe('b');
    expect(getResult().rePickNeeded).toBe(false);
  });

  it('flags rePickNeeded when the stored preference is not in the writable list', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: true });
    mockListWritableCalendars.mockResolvedValue([CAL_A]);
    mockGetPreferredCalendarId.mockResolvedValue('missing-id');

    const { getResult } = await renderUseCalendarSettings();

    expect(getResult().rePickNeeded).toBe(true);
  });

  it('selectCalendar() persists the choice and clears rePickNeeded', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: true });
    mockListWritableCalendars.mockResolvedValue([CAL_A, CAL_B]);
    mockGetPreferredCalendarId.mockResolvedValue('missing-id');

    const { getResult } = await renderUseCalendarSettings();
    expect(getResult().rePickNeeded).toBe(true);

    await act(async () => {
      await getResult().selectCalendar('a');
    });

    expect(mockSetPreferredCalendarId).toHaveBeenCalledWith('a');
    expect(getResult().selectedId).toBe('a');
    expect(getResult().rePickNeeded).toBe(false);
  });
});
