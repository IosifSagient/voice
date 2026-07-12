import type { Dispatch, SetStateAction } from "react";
import { removeReminder } from "../services/calendar";
import { cancelReminder } from "../services/notifications";
import { notesRepository } from "../services/notesRepository";
import type { Note } from "../types/note";

// Completes or deletes an action item inline from the note detail view.
// getNote() only ever returns open action items, so completing one here
// simply removes it from view — reopening a completed item stays a
// Tasks-screen-only action.
export function useNoteActionItems(
  note: Note | null,
  setNote: Dispatch<SetStateAction<Note | null>>
) {
  const removeLocally = (id: string) => {
    setNote((prev) =>
      prev
        ? { ...prev, action_items: prev.action_items.filter((it) => it.id !== id) }
        : null
    );
  };

  const completeItem = async (id: string): Promise<void> => {
    const item = note?.action_items.find((it) => it.id === id);
    await notesRepository.completeActionItem(id);
    if (item?.notification_id) {
      await cancelReminder(item.notification_id);
      await notesRepository.setNotificationId(id, null);
    }
    removeLocally(id);
  };

  const deleteItem = async (id: string): Promise<void> => {
    const reminderIds = await notesRepository.deleteActionItem(id);
    if (reminderIds?.calendarEventId) {
      await removeReminder(reminderIds.calendarEventId);
    }
    if (reminderIds?.notificationId) {
      await cancelReminder(reminderIds.notificationId);
    }
    removeLocally(id);
  };

  return { completeItem, deleteItem };
}
