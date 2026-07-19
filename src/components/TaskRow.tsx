import { useEffect, useRef } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { ExitAnimationsValues } from "react-native-reanimated";
import type { TaskWithContext } from "../types/tasks";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { formatDate } from "../lib/dateFormat";
import { duration, taskTextNudge } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";
import { TaskCheckbox } from "./TaskCheckbox";

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

// Task text on complete (ANIMATION_SPEC.md TASKS): opacity 1.0<->0.5 fade
// and a translateX 0->2->0 nudge, running in parallel with each other and
// with TaskCheckbox's own bounce — both are concurrent reactions to the
// same toggle, not sequenced off one another.
function useTaskTextAnimation(done: boolean) {
  const reducedMotion = useReducedMotionPreference();
  const opacity = useSharedValue(done ? 0.5 : 1);
  const nudge = useSharedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animating into the resting state on mount — see TaskCheckbox for
    // the same reasoning (avoid replaying on initial list load / recycling).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (reducedMotion) {
      opacity.value = done ? 0.5 : 1;
      nudge.value = 0;
      return;
    }

    opacity.value = withTiming(done ? 0.5 : 1, { duration: duration.checkboxTextFade });
    nudge.value = done
      ? withSequence(
          withTiming(taskTextNudge, { duration: duration.checkboxTextFade / 2 }),
          withTiming(0, { duration: duration.checkboxTextFade / 2 })
        )
      : 0;
  }, [done, reducedMotion, opacity, nudge]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: nudge.value }],
  }));
}

// ANIMATION_SPEC.md TASKS > Task Card Deletion: height collapses to 0,
// opacity -> 0, scale -> 0.95, 300ms. `values.currentHeight` is the row's
// measured height at the moment it exits, captured as the animation's
// starting point (Reanimated snapshots the view and animates it as an
// absolute overlay while sibling rows LinearTransition into place
// concurrently, so this collapse is purely this row's own visual exit —
// it doesn't drive the reflow of the rows below it).
function taskCardExiting(values: ExitAnimationsValues) {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }],
      height: values.currentHeight,
    },
    animations: {
      opacity: withTiming(0, { duration: duration.taskDelete }),
      transform: [{ scale: withTiming(0.95, { duration: duration.taskDelete }) }],
      height: withTiming(0, { duration: duration.taskDelete }),
    },
  };
}

export function TaskRow({ task, onPress, onToggle, onDelete }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < todayAthens();
  const textStyle = useTaskTextAnimation(done);

  const contextLabel =
    task.notePeople.length > 0 ? task.notePeople[0] : task.noteSummary;

  const handleLongPress = () => {
    Alert.alert("Διαγραφή ενέργειας;", undefined, [
      { text: "Άκυρο", style: "cancel" },
      { text: "Διαγραφή", style: "destructive", onPress: () => onDelete!(task.id) },
    ]);
  };

  return (
    // Plain FadeIn, not FadeInUp: a task filter re-admitting a row is
    // "returning to view," not a brand-new item, and a translateY would
    // compete with LinearTransition's spring on neighboring rows in the
    // same commit.
    <Animated.View
      layout={reducedMotion ? undefined : LinearTransition.springify()}
      entering={reducedMotion ? undefined : FadeIn.duration(duration.taskEnter)}
      exiting={reducedMotion ? undefined : taskCardExiting}
    >
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onPress}
        onLongPress={onDelete ? handleLongPress : undefined}
      >
        <TaskCheckbox
          done={done}
          onToggle={() => onToggle(task.id)}
          checkboxTestID={`task-checkbox-${task.id}`}
        />

        <View style={styles.textCol}>
          <Animated.Text
            style={[styles.taskText, done && styles.taskTextDone, textStyle]}
            numberOfLines={2}
          >
            {task.text}
          </Animated.Text>
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
    </Animated.View>
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
