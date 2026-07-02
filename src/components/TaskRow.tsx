import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import type { TaskWithContext } from "../types/tasks";
import { colors, spacing, type, radii } from "../config/theme";
import { formatDate } from "../lib/dateFormat";

type Props = {
  task: TaskWithContext;
  onPress: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
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
      { text: "Διαγραφή", style: "destructive", onPress: () => onDelete(task.id) },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      onLongPress={handleLongPress}
    >
      <Pressable
        style={[styles.checkbox, done && styles.checkboxDone]}
        onPress={() => onToggle(task.id)}
        hitSlop={8}
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
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderFaint,
  },
  rowPressed: { opacity: 0.65 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: spacing.md,
    marginTop: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: colors.accent,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.bgBase,
    lineHeight: 15,
  },
  textCol: { flex: 1 },
  taskText: {
    ...type.body,
  },
  taskTextDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  context: {
    ...type.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  due: {
    ...type.meta,
    color: colors.dueText,
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.dueBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  dueOverdue: {
    color: colors.error,
    backgroundColor: colors.recordingMuted,
  },
});
