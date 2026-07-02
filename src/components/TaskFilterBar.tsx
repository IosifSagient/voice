import { ScrollView, Text, Pressable, StyleSheet } from "react-native";
import type { TaskFilter } from "../types/tasks";
import { colors, spacing, type, radii } from "../config/theme";

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

export function TaskFilterBar({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.bar}
    >
      {FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <Pressable
            key={f.value}
            style={({ pressed }) => [
              styles.pill,
              active && styles.pillActive,
              pressed && styles.pillPressed,
            ]}
            onPress={() => onChange(f.value)}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0 },
  container: {
    flexDirection: "row",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  pillActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  pillPressed: { opacity: 0.7 },
  pillText: {
    ...type.meta,
    color: colors.textSecondary,
    fontWeight: "600" as const,
  },
  pillTextActive: {
    color: colors.accent,
  },
});
