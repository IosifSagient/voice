import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTodayTasks } from '../src/hooks/useTodayTasks';
import { notesRepository } from '../src/services/notesRepository';
import { cancelReminder, scheduleReminder } from '../src/services/notifications';
import { bucketTasksByDueDate } from '../src/services/taskBuckets';
import type { TaskWithDueDate, TaskBuckets } from '../src/types/tasks';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    getTasksWithDueDates: jest.fn(),
    completeActionItem: jest.fn(),
    reopenActionItem: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));

jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
  scheduleReminder: jest.fn(),
}));

jest.mock('../src/services/taskBuckets', () => ({
  bucketTasksByDueDate: jest.fn(),
}));

const mockGetTasksWithDueDates = notesRepository.getTasksWithDueDates as jest.Mock;
const mockComplete = notesRepository.completeActionItem as jest.Mock;
const mockReopen = notesRepository.reopenActionItem as jest.Mock;
const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;
const mockBucket = bucketTasksByDueDate as jest.Mock;

const emptyBuckets: TaskBuckets = { overdue: [], today: [], upcoming: [] };

function mkTask(overrides: Partial<TaskWithDueDate> = {}): TaskWithDueDate {
  return {
    id: 't1',
    noteId: 'n1',
    text: 'Call the plumber',
    dueDate: '2026-07-08',
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

// Manual render-hook helper — matches the pattern in useTasks.test.ts (no
// @testing-library/react-hooks is installed).
async function renderUseTodayTasks() {
  let hookResult!: ReturnType<typeof useTodayTasks>;
  function TestComponent() {
    hookResult = useTodayTasks();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return { getResult: () => hookResult };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTasksWithDueDates.mockResolvedValue([]);
  mockBucket.mockReturnValue(emptyBuckets);
});

describe('useTodayTasks — load', () => {
  it('loads rows via the repository and buckets them', async () => {
    const rows = [mkTask()];
    const buckets: TaskBuckets = { overdue: [], today: rows, upcoming: [] };
    mockGetTasksWithDueDates.mockResolvedValue(rows);
    mockBucket.mockReturnValue(buckets);

    const { getResult } = await renderUseTodayTasks();

    expect(mockGetTasksWithDueDates).toHaveBeenCalled();
    expect(mockBucket).toHaveBeenCalledWith(rows, expect.any(Date));
    expect(getResult().loading).toBe(false);
    expect(getResult().error).toBeNull();
    expect(getResult().today).toEqual(rows);
    expect(getResult().overdue).toEqual([]);
    expect(getResult().upcoming).toEqual([]);
  });

  it('sets error and stops loading when the fetch rejects', async () => {
    mockGetTasksWithDueDates.mockRejectedValueOnce(new Error('boom'));
    const { getResult } = await renderUseTodayTasks();
    expect(getResult().loading).toBe(false);
    expect(getResult().error).toBe('boom');
    expect(getResult().overdue).toEqual([]);
    expect(getResult().today).toEqual([]);
    expect(getResult().upcoming).toEqual([]);
  });
});

describe('useTodayTasks — refresh', () => {
  it('reloads when refresh is called', async () => {
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().refresh();
    });

    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(2);
  });

  it('passes a fresh Date instance to bucketTasksByDueDate on every load, not one captured at mount', async () => {
    const { getResult } = await renderUseTodayTasks();
    expect(mockBucket).toHaveBeenCalledTimes(1);
    const firstNow = mockBucket.mock.calls[0][1];

    await act(async () => {
      await getResult().refresh();
    });

    expect(mockBucket).toHaveBeenCalledTimes(2);
    const secondNow = mockBucket.mock.calls[1][1];

    // Guards against a future refactor hoisting `new Date()` out of load()
    // and reusing a stale reference across reloads.
    expect(secondNow).toBeInstanceOf(Date);
    expect(secondNow).not.toBe(firstNow);
  });
});

describe('useTodayTasks — complete', () => {
  it('completes the action item then reloads buckets', async () => {
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().complete('t1');
    });

    expect(mockComplete).toHaveBeenCalledWith('t1');
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(2);
  });

  it('sets error and does not reload when the mutation itself fails', async () => {
    mockComplete.mockRejectedValueOnce(new Error('fail'));
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().complete('t1');
    });

    expect(getResult().error).toBe('fail');
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);
  });

  it('cancels the notification and clears its id when the task being completed has one', async () => {
    const task = mkTask({ id: 't1', notificationId: 'notif-1' });
    mockGetTasksWithDueDates.mockResolvedValue([task]);
    mockBucket.mockReturnValue({ overdue: [], today: [task], upcoming: [] });
    const { getResult } = await renderUseTodayTasks();

    await act(async () => {
      await getResult().complete('t1');
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', null);
  });

  it('skips cancelReminder when the task has no notification, but still clears the id', async () => {
    const task = mkTask({ id: 't1', notificationId: null });
    mockGetTasksWithDueDates.mockResolvedValue([task]);
    mockBucket.mockReturnValue({ overdue: [], today: [task], upcoming: [] });
    const { getResult } = await renderUseTodayTasks();

    await act(async () => {
      await getResult().complete('t1');
    });

    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', null);
  });
});

describe('useTodayTasks — reopen', () => {
  it('reopens the action item then reloads buckets', async () => {
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().reopen('t1');
    });

    expect(mockReopen).toHaveBeenCalledWith('t1');
    // reopen() re-fetches the task directly (local bucket state no longer
    // holds it — it was dropped by complete()'s own reload) and then load()
    // reloads again: mount (1) + reopen's own lookup (2) + load() (3).
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(3);
  });

  it('sets error and does not reload when the mutation itself fails', async () => {
    mockReopen.mockRejectedValueOnce(new Error('fail'));
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().reopen('t1');
    });

    expect(getResult().error).toBe('fail');
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);
  });

  it('reschedules a reminder for the reopened task and persists the new id, fetched fresh rather than from stale bucket state', async () => {
    const task = mkTask({ id: 't1', text: 'Call the plumber', dueDate: '2099-01-01', dueTime: null, allDay: true });
    // Local bucket state is empty (as it would be right after complete()'s
    // reload dropped this now-done item) — only the direct re-fetch has it.
    mockGetTasksWithDueDates.mockResolvedValue([task]);
    mockScheduleReminder.mockResolvedValue('notif-new');
    const { getResult } = await renderUseTodayTasks();

    await act(async () => {
      await getResult().reopen('t1');
    });

    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Call the plumber',
        due_date: '2099-01-01',
        all_day: true,
        note_id: 'n1',
        task_id: 't1',
      }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', 'notif-new');
  });

  it('cancels the orphaned notification without throwing, and still reloads, when persisting the id fails', async () => {
    const task = mkTask({ id: 't1', dueDate: '2099-01-01' });
    mockGetTasksWithDueDates.mockResolvedValue([task]);
    mockScheduleReminder.mockResolvedValue('notif-new');
    mockSetNotificationId.mockRejectedValueOnce(new Error('db write failed'));
    const { getResult } = await renderUseTodayTasks();

    await act(async () => {
      await getResult().reopen('t1');
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-new');
    // reopenActionItem already committed — still reload despite the failure,
    // and no lingering error (load()'s own success clears it regardless).
    expect(getResult().error).toBeNull();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(3);
  });

  it('does not schedule or persist anything when the reopened task cannot be found on re-fetch', async () => {
    mockGetTasksWithDueDates.mockResolvedValue([]);
    const { getResult } = await renderUseTodayTasks();

    await act(async () => {
      await getResult().reopen('missing');
    });

    expect(mockScheduleReminder).not.toHaveBeenCalled();
    expect(mockSetNotificationId).not.toHaveBeenCalled();
  });
});
