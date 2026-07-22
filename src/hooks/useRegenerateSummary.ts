import { useState } from "react";
import { Alert } from "react-native";
import type { Dispatch, SetStateAction } from "react";
import { extractNote } from "../services/extraction";
import { notesRepository } from "../services/notesRepository";
import { applyReminderDiff } from "./reminderDiff";
import type { Note } from "../types/note";

// Re-runs extraction on an edited transcript but applies only summary/people/topics —
// action_items (and their calendar/notification reminders) are carried over from the
// current note untouched, so fixing a transcription typo doesn't reschedule reminders.
export function useRegenerateSummary(
  note: Note | null,
  setNote: Dispatch<SetStateAction<Note | null>>
) {
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = async (transcript: string): Promise<void> => {
    if (!note) return;
    setRegenerating(true);
    try {
      const extracted = await extractNote(transcript);
      const updated: Note = {
        ...note,
        transcript,
        summary: extracted.summary,
        people: extracted.people,
        topics: extracted.topics,
      };
      const diff = await notesRepository.save(updated);
      await applyReminderDiff(diff, updated.id);
      setNote(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Σφάλμα", msg);
      throw e;
    } finally {
      setRegenerating(false);
    }
  };

  return { regenerating, regenerate };
}
