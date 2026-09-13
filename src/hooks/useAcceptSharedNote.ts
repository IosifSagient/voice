import { useState } from "react";
import { notesRepository } from "../services/notesRepository";
import { takePendingShare } from "../services/pendingShare";

// Owns the accept/reject decision for an inbound shared note. Mirrors
// useDeleteNote's narrow shape: one save call, no reminder/calendar
// scheduling (save-only, D1) — the hook never imports
// expo-notifications/expo-calendar, unlike usePipelineRun's post-save
// scheduling block, which this deliberately does not replicate.
export function useAcceptSharedNote() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accept = async (): Promise<string | null> => {
    setError(null);
    const pending = takePendingShare();
    if (!pending) {
      setError("Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί.");
      return null;
    }

    setLoading(true);
    try {
      const noteId = await notesRepository.create(pending.extraction, pending.transcript);
      return noteId;
    } catch (err) {
      console.error("[useAcceptSharedNote:accept] failed to save shared note", err);
      setError("Η αποθήκευση απέτυχε. Δοκίμασε ξανά.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reject = (): void => {
    takePendingShare();
  };

  return { accept, reject, error, loading };
}
