import { View, Text, StyleSheet } from "react-native";
import type { TaskFilter } from "../types/tasks";
import { colors, spacing, type } from "../config/theme";

const MESSAGES: Record<TaskFilter, { title: string; hint: string }> = {
  all: {
    title: "Καμία ενέργεια ακόμα",
    hint: "Οι ενέργειες από τις σημειώσεις σας θα εμφανίζονται εδώ.",
  },
  pending: {
    title: "Δεν υπάρχουν εκκρεμείς ενέργειες",
    hint: "Όλες οι ενέργειές σας έχουν ολοκληρωθεί!",
  },
  completed: {
    title: "Δεν υπάρχουν ολοκληρωμένες ενέργειες",
    hint: "Ολοκληρώστε μια ενέργεια για να εμφανιστεί εδώ.",
  },
  overdue: {
    title: "Δεν υπάρχουν εκπρόθεσμες ενέργειες",
    hint: "Όλες οι ενέργειές σας είναι εντός προθεσμίας.",
  },
};

type Props = {
  filter: TaskFilter;
};

export function TasksEmptyState({ filter }: Props) {
  const { title, hint } = MESSAGES[filter];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xxl,
  },
  title: {
    ...type.bodyLarge,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  hint: {
    ...type.meta,
    color: colors.light.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
