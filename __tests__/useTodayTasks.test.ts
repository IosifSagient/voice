import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTodayTasks } from '../src/hooks/useTodayTasks';
import { notesRepository } from '../src/services/notesRepository';
import { bucketTasksByDueDate } from '../src/services/taskBuckets';
import type { TaskWithDueDate, TaskBuckets } from '../src/types/tasks';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    getTasksWithDueDates: jest.fn(),
    completeActionItem: jest.fn(),
    reopenActionItem: jest.fn(),
  },
}));

jest.mock('../src/services/taskBuckets', () => ({
  bucketTasksByDueDate: jest.fn(),
}));

const mockGetTasksWithDueDates = notesRepository.getTasksWithDueDates as jest.Mock;
const mockComplete = notesRepository.completeActionItem as jest.Mock;
const mockReopen = notesRepository.reopenActionItem as jest.Mock;
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
});

describe('useTodayTasks — reopen', () => {
  it('reopens the action item then reloads buckets', async () => {
    const { getResult } = await renderUseTodayTasks();
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getResult().reopen('t1');
    });

    expect(mockReopen).toHaveBeenCalledWith('t1');
    expect(mockGetTasksWithDueDates).toHaveBeenCalledTimes(2);
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
});
