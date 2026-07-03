import type { Dispatch, SetStateAction } from "react";
import { removeReminder } from "../services/calendar";
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
    await notesRepository.completeActionItem(id);
    removeLocally(id);
  };

  const deleteItem = async (id: string): Promise<void> => {
    const calEventId = await notesRepository.deleteActionItem(id);
    if (calEventId) {
      await removeReminder(calEventId);
    }
    removeLocally(id);
  };

  return { completeItem, deleteItem };
}
