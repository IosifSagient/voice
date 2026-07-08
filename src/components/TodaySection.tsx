import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { TaskWithDueDate } from "../types/tasks";
import { TaskRow } from "./TaskRow";
import { Snackbar } from "./Snackbar";
import { colors, spacing, type } from "../config/theme";

type Props = {
  overdue: TaskWithDueDate[];
  today: TaskWithDueDate[];
  upcoming: TaskWithDueDate[];
  loading: boolean;
  error: string | null;
  onPressTask: (noteId: string) => void;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
};

const SNACKBAR_MESSAGE = "Η εργασία ολοκληρώθηκε — θα τη βρεις στα Ολοκληρωμένα";

function Bucket({
  title,
  headerStyle,
  tasks,
  onPressTask,
  onComplete,
}: {
  title: string;
  headerStyle?: object;
  tasks: TaskWithDueDate[];
  onPressTask: (noteId: string) => void;
  onComplete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.header, headerStyle]}>{title}</Text>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onPress={() => onPressTask(task.noteId)}
          onToggle={() => onComplete(task.id)}
        />
      ))}
    </View>
  );
}

export function TodaySection({
  overdue,
  today,
  upcoming,
  loading,
  error,
  onPressTask,
  onComplete,
  onUndo,
}: Props) {
  // Holds the id of the just-completed item pending an undo window. Keying
  // the Snackbar below by this value forces a remount (fresh timer, full
  // duration) whenever a new completion replaces one still in-flight.
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null);

  const handleComplete = (id: string) => {
    onComplete(id);
    setPendingUndoId(id);
  };

  const handleUndo = () => {
    if (pendingUndoId) onUndo(pendingUndoId);
    setPendingUndoId(null);
  };

  const isEmpty = overdue.length === 0 && today.length === 0 && upcoming.length === 0;

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Bucket
        title="Εκπρόθεσμα"
        headerStyle={styles.headerOverdue}
        tasks={overdue}
        onPressTask={onPressTask}
        onComplete={handleComplete}
      />
      <Bucket
        title="Σήμερα"
        headerStyle={styles.headerToday}
        tasks={today}
        onPressTask={onPressTask}
        onComplete={handleComplete}
      />
      <Bucket
        title="Προσεχώς"
        tasks={upcoming}
        onPressTask={onPressTask}
        onComplete={handleComplete}
      />

      {!loading && isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Τίποτα για σήμερα 🎉</Text>
        </View>
      ) : null}

      <Snackbar
        key={pendingUndoId ?? "none"}
        visible={pendingUndoId !== null}
        message={SNACKBAR_MESSAGE}
        actionLabel="Αναίρεση"
        onAction={handleUndo}
        onDismiss={() => setPendingUndoId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  header: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  headerOverdue: {
    color: colors.error,
  },
  headerToday: {
    color: colors.accent,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...type.bodyLarge,
    color: colors.textSecondary,
    textAlign: "center",
  },
  error: {
    ...type.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
});
