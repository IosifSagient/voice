import { useState } from "react";
import { Alert, Share } from "react-native";
import { copyToClipboard } from "../services/clipboard";
import { formatNoteForShare } from "../lib/formatNoteForShare";
import type { Note } from "../types/note";

const COPY_SNACKBAR_MESSAGE = "Αντιγράφηκε";

// Mirrors useMessageActions' shape (onLongPress there vs two named handlers
// here, since detail/list call copy and share independently rather than off
// one gesture). Pure function of `note` — no draft/mode, so it works from
// any screen that has a Note in hand.
export function useNoteActions(note: Note | null) {
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleCopy = async () => {
    const text = note ? formatNoteForShare(note) : "";
    if (!text) return;
    await copyToClipboard(text);
    setSnackbarVisible(true);
  };

  const handleShare = async () => {
    const text = note ? formatNoteForShare(note) : "";
    if (!text) return;
    try {
      await Share.share({ message: text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Σφάλμα", msg);
    }
  };

  const dismissSnackbar = () => setSnackbarVisible(false);

  return {
    handleCopy,
    handleShare,
    snackbarVisible,
    snackbarMessage: COPY_SNACKBAR_MESSAGE,
    dismissSnackbar,
  };
}
