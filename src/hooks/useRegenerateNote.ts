import { useState } from "react";
import { Alert } from "react-native";
import type { Dispatch, SetStateAction } from "react";
import { extractNote } from "../services/extraction";
import { notesRepository } from "../services/notesRepository";
import type { Note } from "../types/note";

// Re-runs extraction on an edited transcript and saves the result over the existing note.
export function useRegenerateNote(
  note: Note | null,
  setNote: Dispatch<SetStateAction<Note | null>>
) {
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = async (transcript: string): Promise<void> => {
    if (!note) return;
    setRegenerating(true);
    try {
      const extracted = await extractNote(transcript);
      const updated: Note = { ...note, transcript, ...extracted };
      await notesRepository.save(updated);
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
