import { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import { copyToClipboard } from "../services/clipboard";

// Backs the chat bubble long-press copy: owns the single stable onLongPress
// handler (ChatBubble is React.memo'd and takes the message text as an
// argument rather than a factory returning one closure per message, so this
// identity must stay stable across a ChatScreen re-render triggered by
// composer input) plus the copy-confirmation snackbar's visibility.
export function useMessageActions() {
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Haptic fires immediately, acknowledging the long-press gesture itself —
  // with no action sheet there's otherwise no visual response until the
  // clipboard write resolves. The snackbar remains the separate confirmation
  // that the copy actually succeeded.
  const onLongPress = useCallback((text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    copyToClipboard(text)
      .then(() => {
        setSnackbarVisible(true);
      })
      .catch((err) => {
        console.error("[useMessageActions:onLongPress] clipboard write failed", err);
      });
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbarVisible(false);
  }, []);

  return { onLongPress, snackbarVisible, dismissSnackbar };
}
