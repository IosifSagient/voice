import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useNotificationSettings, rescheduleMissingNotifications } from '../src/hooks/useNotificationSettings';
import {
  ensurePermission,
  getPermissionStatus,
  scheduleReminder,
  cancelReminder,
} from '../src/services/notifications';
import { notesRepository } from '../src/services/notesRepository';
import type { TaskWithContext } from '../src/types/tasks';

jest.mock('../src/services/notifications', () => ({
  ensurePermission: jest.fn(),
  getPermissionStatus: jest.fn(),
  scheduleReminder: jest.fn(),
  cancelReminder: jest.fn(),
}));

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    getActionItems: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));

const mockEnsurePermission = ensurePermission as jest.Mock;
const mockGetPermissionStatus = getPermissionStatus as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockGetActionItems = notesRepository.getActionItems as jest.Mock;
const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;

function mkItem(overrides: Partial<TaskWithContext> = {}): TaskWithContext {
  return {
    id: 't1',
    noteId: 'n1',
    text: 'Call the plumber',
    dueDate: '2099-01-01',
    dueTime: null,
    allDay: true,
    status: 'open',
    calendarEventId: null,
    notificationId: null,
    createdAt: 0,
    noteSummary: 'summary',
    notePeople: [],
    ...overrides,
  };
}

async function renderUseNotificationSettings() {
  let hookResult!: ReturnType<typeof useNotificationSettings>;
  function TestComponent() {
    hookResult = useNotificationSettings();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return { getResult: () => hookResult };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetActionItems.mockResolvedValue([]);
});

describe('useNotificationSettings — no permission', () => {
  it('exposes permissionGranted false without scheduling anything', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: false, canAskAgain: true });
    const { getResult } = await renderUseNotificationSettings();

    expect(getResult().loading).toBe(false);
    expect(getResult().permissionGranted).toBe(false);
    expect(mockScheduleReminder).not.toHaveBeenCalled();
  });

  it('requestPermission() grants access and runs the reschedule pass', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true }); // initial load
    const { getResult } = await renderUseNotificationSettings();

    mockEnsurePermission.mockResolvedValueOnce(true);
    mockGetActionItems.mockResolvedValueOnce([
      mkItem({ id: 't1', dueDate: '2099-01-01', notificationId: null }),
    ]);
    mockScheduleReminder.mockResolvedValueOnce('notif-1');
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: true, canAskAgain: true }); // refresh() after granting

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().permissionGranted).toBe(true);
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Call the plumber',
        due_date: '2099-01-01',
        note_id: 'n1',
        task_id: 't1',
      }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', 'notif-1');
  });

  it('requestPermission() does not run the reschedule pass when the user declines', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    const { getResult } = await renderUseNotificationSettings();

    mockEnsurePermission.mockResolvedValueOnce(false);
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true });

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().permissionGranted).toBe(false);
    expect(mockGetActionItems).not.toHaveBeenCalled();
    expect(mockScheduleReminder).not.toHaveBeenCalled();
  });

  it('canAskAgain flips to false once iOS determines the permission and won\'t re-prompt', async () => {
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    const { getResult } = await renderUseNotificationSettings();
    expect(getResult().canAskAgain).toBe(true);

    mockEnsurePermission.mockResolvedValueOnce(false);
    mockGetPermissionStatus.mockResolvedValueOnce({ granted: false, canAskAgain: false });

    await act(async () => {
      await getResult().requestPermission();
    });

    expect(getResult().canAskAgain).toBe(false);
  });
});

describe('useNotificationSettings — permission already granted', () => {
  it('reports granted without running the reschedule pass on initial load', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getResult } = await renderUseNotificationSettings();

    expect(getResult().permissionGranted).toBe(true);
    expect(mockGetActionItems).not.toHaveBeenCalled();
  });
});

describe('rescheduleMissingNotifications', () => {
  it('schedules only open items that have a due date and no notification yet', async () => {
    mockGetActionItems.mockResolvedValue([
      mkItem({ id: 't1', dueDate: '2099-01-01', notificationId: null }),
      mkItem({ id: 't2', dueDate: null, notificationId: null }), // no due date — skipped
      mkItem({ id: 't3', dueDate: '2099-01-01', notificationId: 'already-has-one' }), // skipped
    ]);
    mockScheduleReminder.mockResolvedValue('notif-new');

    await rescheduleMissingNotifications();

    expect(mockScheduleReminder).toHaveBeenCalledTimes(1);
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: '2099-01-01', note_id: 'n1', task_id: 't1' }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', 'notif-new');
  });

  it('does not persist anything when scheduleReminder no-ops (R4/past due date)', async () => {
    mockGetActionItems.mockResolvedValue([mkItem({ id: 't1', dueDate: '2020-01-01', notificationId: null })]);
    mockScheduleReminder.mockResolvedValue(null);

    await rescheduleMissingNotifications();

    expect(mockSetNotificationId).not.toHaveBeenCalled();
  });

  it('cancels the orphaned notification without throwing when persisting the id fails', async () => {
    mockGetActionItems.mockResolvedValue([mkItem({ id: 't1', dueDate: '2099-01-01', notificationId: null })]);
    mockScheduleReminder.mockResolvedValue('notif-new');
    mockSetNotificationId.mockRejectedValueOnce(new Error('db write failed'));

    await expect(rescheduleMissingNotifications()).resolves.toBeUndefined();

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-new');
  });
});
