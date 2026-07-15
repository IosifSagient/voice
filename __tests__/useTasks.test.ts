import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTasks } from '../src/hooks/useTasks';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder, scheduleReminder } from '../src/services/notifications';
import type { TaskFilter, TaskWithContext } from '../src/types/tasks';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    getActionItems: jest.fn(),
    completeActionItem: jest.fn(),
    reopenActionItem: jest.fn(),
    deleteActionItem: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));

jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));

jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
  scheduleReminder: jest.fn(),
}));

const mockGetActionItems = notesRepository.getActionItems as jest.Mock;
const mockComplete = notesRepository.completeActionItem as jest.Mock;
const mockReopen = notesRepository.reopenActionItem as jest.Mock;
const mockDelete = notesRepository.deleteActionItem as jest.Mock;
const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;

function mkTask(overrides: Partial<TaskWithContext> = {}): TaskWithContext {
  return {
    id: 't1',
    noteId: 'n1',
    text: 'Call the plumber',
    dueDate: null,
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

// Manual render-hook helper — no @testing-library/react-hooks is installed.
async function renderUseTasks(filter: TaskFilter) {
  let hookResult!: ReturnType<typeof useTasks>;
  function TestComponent({ filter }: { filter: TaskFilter }) {
    hookResult = useTasks(filter);
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent, { filter }));
  });
  return {
    getResult: () => hookResult,
    rerender: async (newFilter: TaskFilter) => {
      await act(async () => {
        renderer.update(React.createElement(TestComponent, { filter: newFilter }));
      });
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetActionItems.mockResolvedValue([]);
});

describe('useTasks — filter mapping', () => {
  it('pending filter requests open items', async () => {
    await renderUseTasks('pending');
    expect(mockGetActionItems).toHaveBeenCalledWith({ status: 'open' });
  });

  it('completed filter requests done items', async () => {
    await renderUseTasks('completed');
    expect(mockGetActionItems).toHaveBeenCalledWith({ status: 'done' });
  });

  it('overdue filter requests open items due before today', async () => {
    await renderUseTasks('overdue');
    expect(mockGetActionItems).toHaveBeenCalledWith({
      status: 'open',
      dueBefore: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('all filter requests everything', async () => {
    await renderUseTasks('all');
    expect(mockGetActionItems).toHaveBeenCalledWith({});
  });
});

describe('useTasks — loading and error state', () => {
  it('resolves loading false with fetched tasks', async () => {
    const tasks = [mkTask()];
    mockGetActionItems.mockResolvedValue(tasks);
    const { getResult } = await renderUseTasks('all');
    expect(getResult().loading).toBe(false);
    expect(getResult().error).toBeNull();
    expect(getResult().tasks).toEqual(tasks);
  });

  it('sets error and stops loading when the fetch rejects', async () => {
    mockGetActionItems.mockRejectedValueOnce(new Error('boom'));
    const { getResult } = await renderUseTasks('all');
    expect(getResult().loading).toBe(false);
    expect(getResult().error).toBe('boom');
    expect(getResult().tasks).toEqual([]);
  });
});

describe('useTasks — toggle', () => {
  it('completes an open task and refreshes', async () => {
    const task = mkTask({ id: 't1', status: 'open' });
    mockGetActionItems.mockResolvedValue([task]);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockComplete).toHaveBeenCalledWith('t1');
    expect(mockReopen).not.toHaveBeenCalled();
    expect(mockGetActionItems).toHaveBeenCalledTimes(2);
  });

  it('cancels the notification and clears its id when completing a task that has one', async () => {
    const task = mkTask({ id: 't1', status: 'open', notificationId: 'notif-1' });
    mockGetActionItems.mockResolvedValue([task]);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', null);
  });

  it('reopens a done task and refreshes', async () => {
    const task = mkTask({ id: 't1', status: 'done' });
    mockGetActionItems.mockResolvedValue([task]);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockReopen).toHaveBeenCalledWith('t1');
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('reschedules a reminder when reopening a done task and persists the new id', async () => {
    const task = mkTask({
      id: 't1', status: 'done', text: 'Call the plumber',
      dueDate: '2099-01-01', dueTime: '10:00', allDay: false,
    });
    mockGetActionItems.mockResolvedValue([task]);
    mockScheduleReminder.mockResolvedValue('notif-new');
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Call the plumber',
        due_date: '2099-01-01',
        due_time: '10:00',
        all_day: false,
        note_id: 'n1',
        task_id: 't1',
      }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', 'notif-new');
  });

  it('persists null when reopening a task whose due date has already passed (R4 no-op)', async () => {
    const task = mkTask({ id: 't1', status: 'done', dueDate: '2020-01-01' });
    mockGetActionItems.mockResolvedValue([task]);
    mockScheduleReminder.mockResolvedValue(null);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockSetNotificationId).toHaveBeenCalledWith('t1', null);
  });

  it('cancels the orphaned notification without rolling back the (already-committed) reopen when persisting the id fails', async () => {
    const task = mkTask({ id: 't1', status: 'done' });
    mockGetActionItems.mockResolvedValue([task]);
    mockScheduleReminder.mockResolvedValue('notif-new');
    mockSetNotificationId.mockRejectedValueOnce(new Error('db write failed'));
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-new');
    // reopenActionItem already committed server-side — a persist-failure must
    // be swallowed internally rather than falling through to the outer
    // catch's rollback, which would revert the optimistic UI status even
    // though the DB status change is real. Proven here by load() still
    // running (the outer catch's rollback path skips the `await load()` call
    // entirely if it fires) — i.e. a second getActionItems call happened.
    expect(mockGetActionItems).toHaveBeenCalledTimes(2);
  });

  it('rolls back the optimistic update when the toggle call fails', async () => {
    const task = mkTask({ id: 't1', status: 'open' });
    mockGetActionItems.mockResolvedValue([task]);
    mockComplete.mockRejectedValueOnce(new Error('fail'));
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('t1');
    });

    expect(getResult().tasks[0].status).toBe('open');
    // Only the initial load ran — the failed toggle does not trigger a refresh.
    expect(mockGetActionItems).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for an unknown task id', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().toggle('missing');
    });

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockReopen).not.toHaveBeenCalled();
  });
});

describe('useTasks — remove', () => {
  it('deletes the task, removes the calendar reminder, cancels the notification, and refreshes', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    mockDelete.mockResolvedValue({ calendarEventId: 'event-123', notificationId: 'notif-123' });
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().remove('t1');
    });

    expect(mockDelete).toHaveBeenCalledWith('t1');
    expect(mockRemoveReminder).toHaveBeenCalledWith('event-123');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-123');
    expect(mockGetActionItems).toHaveBeenCalledTimes(2);
  });

  it('skips removeReminder/cancelReminder when there is no calendar event or notification', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    mockDelete.mockResolvedValue(null);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().remove('t1');
    });

    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
  });

  it('swallows errors from deleteActionItem without throwing', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    mockDelete.mockRejectedValueOnce(new Error('fail'));
    const { getResult } = await renderUseTasks('all');

    await expect(
      act(async () => {
        await getResult().remove('t1');
      }),
    ).resolves.not.toThrow();
  });
});
