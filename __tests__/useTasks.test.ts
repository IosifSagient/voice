import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTasks } from '../src/hooks/useTasks';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import type { TaskFilter, TaskWithContext } from '../src/types/tasks';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    getActionItems: jest.fn(),
    completeActionItem: jest.fn(),
    reopenActionItem: jest.fn(),
    deleteActionItem: jest.fn(),
  },
}));

jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));

const mockGetActionItems = notesRepository.getActionItems as jest.Mock;
const mockComplete = notesRepository.completeActionItem as jest.Mock;
const mockReopen = notesRepository.reopenActionItem as jest.Mock;
const mockDelete = notesRepository.deleteActionItem as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;

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
  it('deletes the task, removes the calendar reminder, and refreshes', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    mockDelete.mockResolvedValue('event-123');
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().remove('t1');
    });

    expect(mockDelete).toHaveBeenCalledWith('t1');
    expect(mockRemoveReminder).toHaveBeenCalledWith('event-123');
    expect(mockGetActionItems).toHaveBeenCalledTimes(2);
  });

  it('skips removeReminder when there is no calendar event', async () => {
    mockGetActionItems.mockResolvedValue([mkTask({ id: 't1' })]);
    mockDelete.mockResolvedValue(null);
    const { getResult } = await renderUseTasks('all');

    await act(async () => {
      await getResult().remove('t1');
    });

    expect(mockRemoveReminder).not.toHaveBeenCalled();
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
