import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, type, radii } from "../config/theme";

type Props = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 4000,
}: Props) {
  // Restarts whenever visible/message changes (e.g. the parent keys this
  // component by the pending item's id, so a new item replacing a still-open
  // snackbar remounts it — a fresh effect run here, full duration). Cleared
  // on unmount or re-run so a stale timer never fires against gone state.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, message, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.actionBtn}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    ...type.body,
    flex: 1,
  },
  actionBtn: {
    marginLeft: spacing.md,
  },
  actionText: {
    ...type.buttonSmall,
    color: colors.accent,
  },
});
