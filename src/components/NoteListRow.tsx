import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { Note } from "../types/note";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { formatDate } from "../lib/dateFormat";
import { duration, spring, noteCardEntryTranslateY } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

// Peak opacity of the press-darken overlay — subtle, not a visible block of
// color. Local to this component, not a motion.ts token (it's an opacity
// ceiling, not a duration/spring).
const PRESS_OVERLAY_MAX_OPACITY = 0.06;

type Props = {
  note: Note;
  // null = this row does not animate in (already-seen note, e.g. a row
  // revealed by scrolling further down an unchanged list) — see
  // NotesListScreen's entryPlanRef for who gets a delay and why.
  entryDelay: number | null;
  // Bumped by the screen every time entryPlanRef is recomputed. entryDelay
  // alone can't signal "play again" when the same numeric delay recurs
  // (e.g. two consecutive pull-to-refreshes both stagger index 0 as 0ms) —
  // this is what the effect below actually keys off of.
  entryToken: number;
  onPress: () => void;
  onLongPress: () => void;
};

// Presentational only: entrance (opacity/translateY) and press (scale +
// overlay darken) animations live entirely here, same pattern as
// TaskCheckbox / RecordFab. NotesListScreen owns no animation state of its
// own for this row.
export function NoteListRow({ note, entryDelay, entryToken, onPress, onLongPress }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const opacity = useSharedValue(entryDelay == null ? 1 : 0);
  const translateY = useSharedValue(entryDelay == null ? 0 : noteCardEntryTranslateY);
  const pressScale = useSharedValue(1);
  const pressOverlay = useSharedValue(0);

  useEffect(() => {
    if (entryDelay == null) return;

    if (reducedMotion) {
      // ANIMATION_SPEC.md NOTES (HOME) reduced motion: skip stagger, all
      // participating cards fade in together — no per-card delay, no translateY.
      opacity.value = withTiming(1, { duration: duration.base });
      translateY.value = 0;
      return;
    }

    opacity.value = withDelay(entryDelay, withTiming(1, { duration: duration.cardEntry }));
    translateY.value = withDelay(entryDelay, withTiming(0, { duration: duration.cardEntry }));
    // entryToken (not entryDelay) is the intentional replay trigger — see the
    // Props comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryToken]);

  const handlePressIn = () => {
    if (reducedMotion) {
      pressOverlay.value = withTiming(1, { duration: duration.cardPress });
      return;
    }
    pressScale.value = withTiming(0.98, { duration: duration.cardPress });
    pressOverlay.value = withTiming(1, { duration: duration.cardPress });
  };

  const handlePressOut = () => {
    if (reducedMotion) {
      pressOverlay.value = withTiming(0, { duration: duration.cardPress });
      return;
    }
    pressScale.value = withSpring(1, spring.cardPress);
    pressOverlay.value = withTiming(0, { duration: duration.cardPress });
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: pressScale.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: pressOverlay.value * PRESS_OVERLAY_MAX_OPACITY,
  }));

  return (
    <Animated.View style={cardStyle}>
      <Pressable
        testID="notes-list-row"
        style={styles.row}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
      >
        {/* Background darken overlay, not a bg color mutation — see ANIMATION_SPEC.md. */}
        <Animated.View style={[styles.pressOverlay, overlayStyle]} pointerEvents="none" />
        <Text style={styles.rowDate}>{formatDate(note.timestamp)}</Text>
        <Text style={styles.rowSummary} numberOfLines={2}>
          {note.summary || "—"}
        </Text>
        {(note.openActionCount ?? 0) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {note.openActionCount === 1
                ? "1 ενέργεια"
                : `${note.openActionCount} ενέργειες`}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.cardSm,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.light.accent,
    overflow: "hidden",
    ...shadows.light.card,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.light.text,
  },
  rowDate: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.light.accent,
    marginBottom: spacing.sm,
  },
  rowSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.light.text,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: colors.light.accentLight,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...type.meta,
    fontWeight: "600",
    color: colors.light.accent,
  },
});
