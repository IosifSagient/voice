import { useState, useEffect, useCallback } from "react";
import { notesRepository } from "../services/notesRepository";
import { cancelReminder, scheduleReminder } from "../services/notifications";
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

  // Only the current (pre-reload) buckets ever hold this item — getTasksWithDueDates
  // only returns open rows, so once complete() reloads, a just-completed item is
  // gone from state and can't be looked up here again (see reopen()'s comment).
  const findTask = (id: string): TaskWithDueDate | undefined =>
    state.overdue.find((t) => t.id === id) ??
    state.today.find((t) => t.id === id) ??
    state.upcoming.find((t) => t.id === id);

  const complete = async (id: string) => {
    const task = findTask(id);
    try {
      await notesRepository.completeActionItem(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg }));
      return;
    }
    if (task?.notificationId) {
      await cancelReminder(task.notificationId);
    }
    await notesRepository.setNotificationId(id, null);
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
    // The item was completed (and dropped from state by complete()'s reload)
    // before this undo fires, so its due_date/text must be re-fetched fresh
    // rather than read from local bucket state, which no longer has it.
    const rows = await notesRepository.getTasksWithDueDates();
    const task = rows.find((t) => t.id === id);
    if (task) {
      const notificationId = await scheduleReminder({
        text: task.text,
        due_date: task.dueDate,
        due_time: task.dueTime,
        all_day: task.allDay,
        note_id: task.noteId,
        task_id: task.id,
      });
      if (notificationId) {
        try {
          await notesRepository.setNotificationId(id, notificationId);
        } catch {
          // reopenActionItem already committed, and the load() below always
          // clears `error` on its own success — setting state.error here would
          // just be overwritten before the next render, so there's nothing
          // useful to surface. Cancel the now-unrecorded, otherwise
          // uncancellable notification and swallow, matching the other
          // schedule-then-persist call sites (usePipelineRun, applyReminderDiff,
          // useTasks.toggle).
          await cancelReminder(notificationId);
        }
      } else {
        await notesRepository.setNotificationId(id, null);
      }
    }
    await load();
  };

  return { ...state, refresh: load, complete, reopen };
}
