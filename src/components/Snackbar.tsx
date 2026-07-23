import { useEffect, useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { duration, easing } from "../config/motion";

type Props = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

// Fade+settle entrance/exit distance, px. Not sourced from motion.ts — that
// file centralizes duration/easing only; translate distances for a specific
// transition live next to their usage (see ChatBubble's MessageBubble for
// the same convention).
const TRANSLATE_Y = 8;

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

  // Stays mounted through the exit transition: `visible` flipping false
  // starts the fade/translate-out below, and only once it finishes does
  // `rendered` flip false and this actually stop rendering.
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      progress.value = withTiming(1, { duration: duration.base, easing: easing.out });
      return;
    }

    progress.value = withTiming(0, { duration: duration.base, easing: easing.out });
    const timer = setTimeout(() => setRendered(false), duration.base);
    return () => clearTimeout(timer);
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * TRANSLATE_Y }],
  }));

  if (!rendered) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.actionBtn}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.light.card,
  },
  message: {
    ...type.body,
    color: colors.light.text,
    flex: 1,
  },
  actionBtn: {
    marginLeft: spacing.md,
  },
  actionText: {
    ...type.buttonSmall,
    color: colors.light.accent,
  },
});
