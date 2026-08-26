import { notesRepository } from "../services/notesRepository";
import { removeReminder } from "../services/calendar";
import { cancelReminder } from "../services/notifications";

// Owns the delete + reminder-cleanup sequence moved verbatim out of
// NotesListScreen and NoteDetailScreen. Callers keep their own confirm
// Alert and their own differing post-delete step (onDeleted) — this hook
// only exists (rather than a plain service function) because
// cancelReminder/removeReminder are hooks-only per AGENTS.md.
export function useDeleteNote() {
  const deleteNote = async (noteId: string, { onDeleted }: { onDeleted: () => void }) => {
    const reminders = await notesRepository.delete(noteId);
    for (const r of reminders) {
      if (r.calendarEventId) await removeReminder(r.calendarEventId);
      if (r.notificationId) await cancelReminder(r.notificationId);
    }
    onDeleted();
  };

  return { deleteNote };
}
