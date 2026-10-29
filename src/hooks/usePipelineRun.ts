import { useState } from "react";
import { transcribe } from "../services/transcription";
import { extractNote } from "../services/extraction";
import { notesRepository } from "../services/notesRepository";
import {
  getPermissionStatus,
  ensurePermission,
  scheduleReminder,
  cancelReminder,
} from "../services/notifications";
import type { Note } from "../types/note";

type PipelinePhase =
  | "idle"
  | "transcribing"
  | "extracting"
  | "done"
  | "error"
  // Transcription succeeded but produced nothing usable (silence / too-short
  // recording) — distinct from "error": nothing failed, there's just no note
  // to build. No DB write happens for this phase.
  | "empty";

export type PipelineRunState = {
  phase: PipelinePhase;
  note: Note | null;
  error: string | null;
  // True only when the last failure was a transcription failure against a
  // still-available recording uri — i.e. retry() has something to re-run.
  canRetry: boolean;
  setNote: React.Dispatch<React.SetStateAction<Note | null>>;
  runFromUri: (uri: string) => Promise<void>;
  runFromText: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

// Owns the transcribe → extract → save → reload pipeline.
// runFromUri goes through STT first; runFromText skips straight to extraction.
export function usePipelineRun(): PipelineRunState {
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const run = async (transcript: string, skipTranscribe: boolean, uri?: string) => {
    setNote(null);
    setError(null);
    setFailedUri(null);
    try {
      let text = transcript;
      if (!skipTranscribe && uri) {
        setPhase("transcribing");
        try {
          text = await transcribe(uri);
        } catch (e) {
          // Preserve the uri so the caller can retry against the SAME
          // recording instead of forcing a brand-new one.
          setFailedUri(uri);
          throw e;
        }
      }

      if (!text.trim()) {
        setPhase("empty");
        return;
      }

      setPhase("extracting");
      const extracted = await extractNote(text);
      const noteId = await notesRepository.create(extracted, text);
      const saved = await notesRepository.get(noteId);

      // Automatic, independent of the calendar toggle: any due-dated action
      // item gets a local notification scheduled. Permission is requested
      // contextually here — the first save that actually produces one —
      // rather than at app launch.
      const dueDatedItems = saved?.action_items.filter((item) => item.due_date) ?? [];
      if (dueDatedItems.length > 0) {
        const { granted } = await getPermissionStatus();
        if (!granted) {
          await ensurePermission();
        }
        for (const item of dueDatedItems) {
          if (!item.id) continue;
          const notificationId = await scheduleReminder({
            ...item,
            note_id: noteId,
            task_id: item.id,
          });
          if (notificationId) {
            try {
              await notesRepository.setNotificationId(item.id, notificationId);
              item.notification_id = notificationId;
            } catch {
              // The note itself is already saved — a bookkeeping failure here
              // must not fail the whole pipeline. Cancel the now-unrecorded
              // (and otherwise uncancellable) notification and move on.
              await cancelReminder(notificationId);
            }
          }
        }
      }

      setNote(saved);
      setPhase("done");
    } catch (e: any) {
      setError(e.message ?? String(e));
      setPhase("error");
    }
  };

  const runFromUri = (uri: string) => run("", false, uri);
  const runFromText = (text: string) => run(text, true);
  const retry = () => (failedUri ? run("", false, failedUri) : Promise.resolve());

  const reset = () => {
    setPhase("idle");
    setNote(null);
    setError(null);
    setFailedUri(null);
  };

  return {
    phase,
    note,
    error,
    canRetry: failedUri !== null,
    setNote,
    runFromUri,
    runFromText,
    retry,
    reset,
  };
}
