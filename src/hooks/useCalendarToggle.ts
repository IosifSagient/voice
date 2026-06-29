import { Alert } from "react-native";
import type { Dispatch, SetStateAction } from "react";
import { ensurePermission, addReminder, removeReminder } from "../services/calendar";
import { notesRepository } from "../services/notesRepository";
import type { Note } from "../types/note";

// Adds or removes a device calendar event for a single action item.
// Returns a stable callback suitable for passing to NoteCard's onToggleCalendar prop.
export function useCalendarToggle(
  note: Note | null,
  setNote: Dispatch<SetStateAction<Note | null>>
) {
  return async (itemId: string, currentEventId: string | null): Promise<void> => {
    if (currentEventId) {
      await removeReminder(currentEventId);
      await notesRepository.setCalendarEvent(itemId, null);
      setNote((prev) =>
        prev
          ? {
              ...prev,
              action_items: prev.action_items.map((it) =>
                it.id === itemId ? { ...it, calendar_event_id: null } : it
              ),
            }
          : null
      );
      return;
    }

    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(
        "Ημερολόγιο",
        "Χρειάζεται πρόσβαση στο ημερολόγιο για να προσθέσεις υπενθύμιση."
      );
      return;
    }

    const item = note?.action_items.find((it) => it.id === itemId);
    if (!item?.due_date) return;

    const eventId = await addReminder({
      text: item.text,
      due_date: item.due_date,
      due_time: item.due_time,
      all_day: item.all_day,
    });
    if (!eventId) return;

    await notesRepository.setCalendarEvent(itemId, eventId);
    setNote((prev) =>
      prev
        ? {
            ...prev,
            action_items: prev.action_items.map((it) =>
              it.id === itemId ? { ...it, calendar_event_id: eventId } : it
            ),
          }
        : null
    );
  };
}
