import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { duration, spring } from "../config/motion";
import type { TagChip } from "../types/tags";

type Props = {
  activeChip: TagChip | null;
  onPress: () => void;
};

// Trigger for TagFilterSheet (increment 3). Mounted inline in the search
// band, beside AnimatedSearchInput (NotesListScreen's searchRow), not on its
// own full-width row — sizing/spacing here assumes a flex-row sibling with a
// flexible search input, not a standalone row of its own. Purely
// presentational: label switches between the static "Φίλτρα" prompt and the
// active chip's own display label, funnel icon mirrors the same state, shape
// rhymes with AnimatedSearchInput next to it (radii.lg, borderWidth 1).
// Press feedback is a spring.cardPress scale (same shared-value/withTiming-in,
// withSpring-out shape as NoteListRow's card press), not a static opacity
// swap.
export function TagFilterButton({ activeChip, onPress }: Props) {
  const active = activeChip !== null;
  const pressScale = useSharedValue(1);

  const handlePressIn = () => {
    pressScale.value = withTiming(0.98, { duration: duration.cardPress });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, spring.cardPress);
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const iconColor = active ? colors.white : colors.textSecondary;

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pill, active && styles.pillActive]}
        testID="tag-filter-button"
      >
        <Ionicons
          testID="tag-filter-button-icon"
          name={active ? "funnel" : "funnel-outline"}
          size={14}
          color={iconColor}
        />
        <Text
          testID="tag-filter-button-label"
          style={[styles.label, active && styles.labelActive]}
          numberOfLines={1}
        >
          {active ? activeChip!.label : "Φίλτρα"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.borderLight,
    // Caps how wide a long active chip label can push this — searchRow's
    // search input has flex:1 and shrinks to make room, so without a cap a
    // long label could squeeze the input down to near nothing. numberOfLines
    // 1 on the label below ellipsis-truncates whatever doesn't fit.
    maxWidth: 140,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    ...shadows.light.button,
  },
  label: {
    ...type.meta,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  labelActive: {
    color: colors.white,
  },
});
