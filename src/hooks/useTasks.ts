import { useState, useEffect, useCallback } from 'react';
import { notesRepository } from '../services/notesRepository';
import { removeReminder } from '../services/calendar';
import { cancelReminder, scheduleReminder } from '../services/notifications';
import { buildAnchor } from '../lib/dateAnchor';
import type { TaskFilter, TaskWithContext } from '../types/tasks';

type State = {
  tasks: TaskWithContext[];
  loading: boolean;
  error: string | null;
};

// Returns yesterday's date in Athens time as YYYY-MM-DD.
// Passed as dueBefore to getActionItemsFiltered so only items strictly before
// today are returned (the DB treats dueBefore as end-of-day inclusive).
function yesterdayAthens(): string {
  const { iso } = buildAnchor();
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

async function fetchForFilter(filter: TaskFilter): Promise<TaskWithContext[]> {
  switch (filter) {
    case 'pending':
      return notesRepository.getActionItems({ status: 'open' });
    case 'completed':
      return notesRepository.getActionItems({ status: 'done' });
    case 'overdue':
      return notesRepository.getActionItems({ status: 'open', dueBefore: yesterdayAthens() });
    default: // 'all'
      return notesRepository.getActionItems({});
  }
}

export function useTasks(filter: TaskFilter) {
  const [state, setState] = useState<State>({
    tasks: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tasks = await fetchForFilter(filter);
      setState({ tasks, loading: false, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string) => {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic update
    const next = task.status === 'done' ? 'open' : 'done';
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: next } : t)),
    }));

    try {
      if (task.status === 'done') {
        // Reopening: reschedule if the due date is still in the future —
        // scheduleReminder itself silently no-ops per R4 if it has passed.
        await notesRepository.reopenActionItem(id);
        const notificationId = await scheduleReminder({
          text: task.text,
          due_date: task.dueDate,
          due_time: task.dueTime,
          all_day: task.allDay,
        });
        if (notificationId) {
          try {
            await notesRepository.setNotificationId(id, notificationId);
          } catch {
            // reopenActionItem already committed — a persist failure here must
            // NOT fall through to the outer catch's rollback below, which would
            // revert the optimistic status even though the DB status change is
            // real, creating a UI/DB mismatch. Cancel the now-unrecorded
            // notification and swallow instead.
            await cancelReminder(notificationId);
          }
        } else {
          await notesRepository.setNotificationId(id, null);
        }
      } else {
        await notesRepository.completeActionItem(id);
        if (task.notificationId) {
          await cancelReminder(task.notificationId);
        }
        await notesRepository.setNotificationId(id, null);
      }
      await load();
    } catch {
      // Rollback
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? task : t)),
      }));
    }
  };

  const remove = async (id: string) => {
    try {
      const reminderIds = await notesRepository.deleteActionItem(id);
      if (reminderIds?.calendarEventId) {
        await removeReminder(reminderIds.calendarEventId);
      }
      if (reminderIds?.notificationId) {
        await cancelReminder(reminderIds.notificationId);
      }
      await load();
    } catch {
      // Alert already shown by TaskRow — swallow here to avoid double-alerting
    }
  };

  return { ...state, refresh: load, toggle, remove };
}
