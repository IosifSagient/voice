import { notesRepository } from "../services/notesRepository";
import { removeReminder } from "../services/calendar";
import { cancelReminder, scheduleReminder } from "../services/notifications";
import type { UpdateNoteDiff } from "../types/note";

// Cancels/reschedules calendar events and notifications for what updateNote's
// diff reports changed. Shared by useRegenerateSummary and NoteDetailScreen's
// save handler — both call notesRepository.save() and must react identically
// to its diff, so this lives in one place.
export async function applyReminderDiff(diff: UpdateNoteDiff, noteId: string): Promise<void> {
  for (const r of diff.removed) {
    if (r.calendarEventId) await removeReminder(r.calendarEventId);
    if (r.notificationId) await cancelReminder(r.notificationId);
  }
  for (const c of diff.changed) {
    // Calendar events are intentionally left alone here — a matched row's
    // calendar_event_id survives due_date edits by existing (accepted)
    // design; only the notification, which is new, gets cancelled+rescheduled.
    if (c.notificationId) await cancelReminder(c.notificationId);
    const newNotificationId = await scheduleReminder({
      ...c.item,
      note_id: noteId,
      task_id: c.id,
    });
    if (newNotificationId) {
      try {
        await notesRepository.setNotificationId(c.id, newNotificationId);
      } catch {
        // The note save itself already succeeded — don't fail the whole
        // regenerate/edit over a bookkeeping failure. Cancel the now-unrecorded
        // notification instead of leaving it orphaned and uncancellable.
        await cancelReminder(newNotificationId);
      }
    } else {
      await notesRepository.setNotificationId(c.id, null);
    }
  }
}
