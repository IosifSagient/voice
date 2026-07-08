import { useState, useEffect, useCallback } from "react";
import { notesRepository } from "../services/notesRepository";
import { bucketTasksByDueDate } from "../services/taskBuckets";
import type { TaskWithDueDate } from "../types/tasks";

type State = {
  overdue: TaskWithDueDate[];
  today: TaskWithDueDate[];
  upcoming: TaskWithDueDate[];
  loading: boolean;
  error: string | null;
};

const EMPTY: Omit<State, "loading" | "error"> = {
  overdue: [],
  today: [],
  upcoming: [],
};

export function useTodayTasks() {
  const [state, setState] = useState<State>({
    ...EMPTY,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const rows = await notesRepository.getTasksWithDueDates();
      // `now` must be captured fresh on every call so refresh() reflects the
      // current moment, not the Date the hook first mounted with.
      const buckets = bucketTasksByDueDate(rows, new Date());
      setState({ ...buckets, loading: false, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const complete = async (id: string) => {
    try {
      await notesRepository.completeActionItem(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg }));
      return;
    }
    await load();
  };

  const reopen = async (id: string) => {
    try {
      await notesRepository.reopenActionItem(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg }));
      return;
    }
    await load();
  };

  return { ...state, refresh: load, complete, reopen };
}
