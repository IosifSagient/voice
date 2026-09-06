import { useState } from "react";
import { Alert, Share } from "react-native";
import { copyToClipboard } from "../services/clipboard";
import { formatNoteForShare } from "../lib/formatNoteForShare";
import { encodeShare } from "../services/shareCodec";
import { buildShareUrl } from "../config/shareLink";
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

  // Encodes the note into a shareable link (services/shareCodec.ts) and hands
  // it to the OS share sheet — distinct from handleShare above, which shares
  // formatted plain text with no link. Fields are passed straight from the
  // hydrated Note: it's a structural superset of ExtractedNote, and
  // encodeShare's own field-by-field copy already drops app-managed action
  // item fields (id/status/calendar_event_id/notification_id), so no mapping
  // step is needed here.
  const handleSendToUser = async () => {
    if (!note) return;
    const result = encodeShare(
      {
        summary: note.summary,
        people: note.people,
        topics: note.topics,
        action_items: note.action_items,
      },
      note.transcript,
    );

    if (!result.ok) {
      Alert.alert("Σφάλμα", "Η σημείωση είναι πολύ μεγάλη για αποστολή μέσω συνδέσμου.");
      return;
    }

    // result.meta.truncated (transcript dropped to fit) is deliberately
    // silent — no notice, the share proceeds as normal.
    const url = buildShareUrl(result.fragment);
    try {
      await Share.share({ message: `Σημείωση από το Ask Lisa:\n${url}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Σφάλμα", msg);
    }
  };

  const dismissSnackbar = () => setSnackbarVisible(false);

  return {
    handleCopy,
    handleShare,
    handleSendToUser,
    snackbarVisible,
    snackbarMessage: COPY_SNACKBAR_MESSAGE,
    dismissSnackbar,
  };
}
