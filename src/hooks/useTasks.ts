import { useState, useEffect, useCallback } from 'react';
import { notesRepository } from '../services/notesRepository';
import { removeReminder } from '../services/calendar';
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
        await notesRepository.reopenActionItem(id);
      } else {
        await notesRepository.completeActionItem(id);
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
      const calEventId = await notesRepository.deleteActionItem(id);
      if (calEventId) {
        await removeReminder(calEventId);
      }
      await load();
    } catch {
      // Alert already shown by TaskRow — swallow here to avoid double-alerting
    }
  };

  return { ...state, refresh: load, toggle, remove };
}
