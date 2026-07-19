import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import type { ActionItem } from "../types/note";
import { colors, spacing, type, radii } from "../config/theme";

type Props = {
  item: ActionItem;
  onToggleCalendar?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
};

export function FollowUpRow({ item, onToggleCalendar, onComplete, onDelete }: Props) {
  const hasCalendar = !!item.calendar_event_id;

  const handleLongPress = () => {
    Alert.alert("Διαγραφή ενέργειας;", undefined, [
      { text: "Άκυρο", style: "cancel" },
      { text: "Διαγραφή", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <Pressable
      style={styles.row}
      onLongPress={onDelete ? handleLongPress : undefined}
    >
      {onComplete ? (
        <Pressable
          style={styles.checkbox}
          onPress={onComplete}
          hitSlop={8}
        />
      ) : (
        <View style={styles.dot} />
      )}
      <View style={styles.textCol}>
        <Text style={styles.action}>{item.text}</Text>
        {item.due_date ? (
          <View style={styles.dueRow}>
            <Text style={styles.due}>{item.due_date}</Text>
            {item.id && onToggleCalendar ? (
              <Pressable
                onPress={onToggleCalendar}
                style={({ pressed }) => [styles.calBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.calBtnText, hasCalendar && styles.calBtnTextActive]}>
                  {hasCalendar ? "✓ Ημερολόγιο" : "Στο ημερολόγιο"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.accent,
    marginRight: spacing.md,
    marginTop: 7,
    flexShrink: 0,
  },
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
  },
  textCol: {
    flex: 1,
  },
  action: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.light.text,
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  due: {
    ...type.meta,
    color: colors.light.textMuted,
    backgroundColor: colors.light.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  calBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  calBtnText: {
    ...type.meta,
    color: colors.light.textMuted,
  },
  calBtnTextActive: {
    color: colors.light.accent,
  },
  pressed: {
    opacity: 0.6,
  },
});
