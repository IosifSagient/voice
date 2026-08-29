import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { Note } from "../types/note";
import { colors, spacing } from "../config/theme";
import { formatDateRail } from "../lib/dateFormat";
import { duration, noteCardEntryTranslateY } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

const PRESS_DIM_OPACITY = 0.55;
const RAIL_WIDTH = 46;

type Props = {
  note: Note;
  entryDelay: number | null;
  entryToken: number;
  // First row of each date run shows the rail label; repeats within the same
  // day suppress it so the day-number doesn't stutter down the list. Computed
  // at the list level (NotesListScreen railItems), so it's virtualization-safe.
  showRail: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

// Presentational only: entrance (opacity/translateY) and press (opacity dim)
// animations live here. Flat timeline row — no card surface, so press is a
// list-row dim, not the old scale+darken-overlay.
export function NoteListRow({
  note,
  entryDelay,
  entryToken,
  showRail,
  onPress,
  onLongPress,
}: Props) {
  const reducedMotion = useReducedMotionPreference();
  const opacity = useSharedValue(entryDelay == null ? 1 : 0);
  const translateY = useSharedValue(
    entryDelay == null ? 0 : noteCardEntryTranslateY,
  );
  const pressDim = useSharedValue(1);

  useEffect(() => {
    if (entryDelay == null) return;
    if (reducedMotion) {
      opacity.value = withTiming(1, { duration: duration.base });
      translateY.value = 0;
      return;
    }
    opacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: duration.cardEntry }),
    );
    translateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: duration.cardEntry }),
    );
    // entryToken (not entryDelay) is the intentional replay trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryToken]);

  const handlePressIn = () => {
    pressDim.value = withTiming(PRESS_DIM_OPACITY, {
      duration: duration.cardPress,
    });
  };
  const handlePressOut = () => {
    pressDim.value = withTiming(1, { duration: duration.cardPress });
  };

  // Entrance opacity and press-dim multiply cleanly: entrance runs 0→1 with
  // dim at 1; press holds opacity at 1 and drives dim 1→0.55.
  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * pressDim.value,
    transform: [{ translateY: translateY.value }],
  }));

  const { day, month } = formatDateRail(note.timestamp);
  const actionCount = note.openActionCount ?? 0;

  return (
    <Animated.View style={rowStyle}>
      <Pressable
        testID="notes-list-row"
        style={styles.row}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
      >
        <View style={styles.rail}>
          {showRail && (
            <>
              <Text style={styles.railDay}>{day}</Text>
              <Text style={styles.railMonth}>{month}</Text>
            </>
          )}
        </View>
        <View style={styles.body}>
          <Text
            style={styles.summary}
            numberOfLines={2}
          >
            {note.summary || "—"}
          </Text>
          {actionCount > 0 && (
            <Text style={styles.action}>
              {actionCount === 1 ? "1 ενέργεια" : `${actionCount} ενέργειες`} →
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: "flex-end",
    paddingTop: 1,
  },
  railDay: {
    fontFamily: "Literata_500Medium",
    fontSize: 19,
    lineHeight: 20,
    color: colors.text,
  },
  railMonth: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 1,
  },
  body: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    paddingLeft: spacing.base,
    marginLeft: spacing.md,
  },
  summary: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  action: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: colors.accent,
    marginTop: spacing.xs + 2,
  },
});
