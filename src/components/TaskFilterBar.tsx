import { useEffect } from "react";
import { ScrollView, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { TaskFilter } from "../types/tasks";
import { colors, spacing, type, radii } from "../config/theme";
import { duration } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "Όλα" },
  { value: "pending", label: "Εκκρεμή" },
  { value: "completed", label: "Ολοκληρωμένα" },
  { value: "overdue", label: "Εκπρόθεσμα" },
];

type Props = {
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
};

// ANIMATION_SPEC.md TASKS > Filter Pills: background color crossfade only —
// text stays a constant on-dark color, active state is communicated purely
// by the background opacity step.
function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = active ? 1 : 0;
      return;
    }
    progress.value = withTiming(active ? 1 : 0, { duration: duration.filterPillSwap });
  }, [active, reducedMotion, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.light.filterPillBg, colors.light.filterPillBgActive]
    ),
  }));

  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.pillPressed]}
      onPress={onPress}
    >
      <Animated.View style={[styles.pill, pillStyle]}>
        <Text style={styles.pillText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function TaskFilterBar({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.bar}
    >
      {FILTERS.map((f) => (
        <FilterPill
          key={f.value}
          label={f.label}
          active={f.value === value}
          onPress={() => onChange(f.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0 },
  container: {
    flexDirection: "row",
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.borderGlass,
  },
  pillPressed: { opacity: 0.7 },
  pillText: {
    ...type.meta,
    color: colors.light.textOnDark,
    fontWeight: "600" as const,
  },
});
