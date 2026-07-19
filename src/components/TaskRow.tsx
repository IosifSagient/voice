import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import type { TaskWithContext } from "../types/tasks";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { formatDate } from "../lib/dateFormat";

type Props = {
  task: TaskWithContext;
  onPress: () => void;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
};

function formatDueDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // noon avoids DST/timezone-boundary edge cases when converting to timestamp
  return formatDate(new Date(y, m - 1, d, 12).getTime());
}

function todayAthens(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
}

export function TaskRow({ task, onPress, onToggle, onDelete }: Props) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < todayAthens();

  const contextLabel =
    task.notePeople.length > 0 ? task.notePeople[0] : task.noteSummary;

  const handleLongPress = () => {
    Alert.alert("Διαγραφή ενέργειας;", undefined, [
      { text: "Άκυρο", style: "cancel" },
      { text: "Διαγραφή", style: "destructive", onPress: () => onDelete!(task.id) },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      onLongPress={onDelete ? handleLongPress : undefined}
    >
      <Pressable
        style={[styles.checkbox, done && styles.checkboxDone]}
        onPress={() => onToggle(task.id)}
        hitSlop={8}
        testID={`task-checkbox-${task.id}`}
      >
        {done && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>

      <View style={styles.textCol}>
        <Text style={[styles.taskText, done && styles.taskTextDone]} numberOfLines={2}>
          {task.text}
        </Text>
        {contextLabel ? (
          <Text style={styles.context} numberOfLines={1}>
            {contextLabel}
          </Text>
        ) : null}
        {task.dueDate ? (
          <Text style={[styles.due, overdue && styles.dueOverdue]}>
            {formatDueDate(task.dueDate)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.cardSm,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.light.card,
  },
  rowPressed: { opacity: 0.65 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.light.accent,
    backgroundColor: colors.light.accentFaint,
    marginRight: spacing.md,
    marginTop: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: colors.light.accent,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.light.textOnDark,
    lineHeight: 15,
  },
  textCol: { flex: 1 },
  taskText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.light.text,
  },
  taskTextDone: {
    textDecorationLine: "line-through",
    color: colors.light.textMuted,
  },
  context: {
    ...type.meta,
    color: colors.light.textMuted,
    marginTop: spacing.xs,
  },
  due: {
    ...type.meta,
    color: colors.light.textMuted,
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.light.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  dueOverdue: {
    color: colors.light.destructive,
  },
});
