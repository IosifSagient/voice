import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, type, radii } from "../config/theme";
import { duration, easing } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

type Props = {
  label: string;
  variant: "person" | "topic";
  selected: boolean;
  onPress: () => void;
};

// Design 1b's fill/text endpoints per variant. Person reuses the existing
// green `accent` family (no new green token — see theme.ts); topic uses the
// new terracotta `topicAccent` family. Both variants use the same-shaped
// pair (faint tint unselected -> solid fill selected, text inverts to
// textOnDark) so the two chip kinds read as one consistent system.
const VARIANT_COLORS = {
  person: {
    fillUnselected: colors.light.accentFaint,
    fillSelected: colors.light.accent,
    textUnselected: colors.light.accent,
  },
  topic: {
    fillUnselected: colors.light.topicAccentFaint,
    fillSelected: colors.light.topicAccent,
    textUnselected: colors.light.topicAccent,
  },
} as const;

// Dedicated selectable filter chip for NoteTagFilterBar (design 1b) — kept
// separate from Tag.tsx on purpose so NoteCard's display-only tags can never
// be affected by this restyle. Renders the full 1b treatment: filled/tinted
// pill with an animated active-state crossfade. Always interactive — no
// display-only mode, unlike Tag.
export function FilterChip({ label, variant, selected, onPress }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = selected ? 1 : 0;
      return;
    }
    progress.value = withTiming(selected ? 1 : 0, {
      duration: duration.filterPillSwap,
      easing: easing.standard,
    });
  }, [selected, reducedMotion, progress]);

  const palette = VARIANT_COLORS[variant];

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.fillUnselected, palette.fillSelected]
    ),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [palette.textUnselected, colors.light.textOnDark]
    ),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      testID={`filter-chip-${variant}`}
    >
      <Animated.View style={[styles.pill, pillStyle]}>
        <Animated.Text style={[styles.label, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  label: {
    ...type.meta,
    fontWeight: "600",
  },
  pressed: { opacity: 0.7 },
});
