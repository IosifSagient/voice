import { View, Text, Pressable, StyleSheet } from "react-native";
import type { ActionItem } from "../types/note";
import { colors, spacing, type, radii } from "../config/theme";

type Props = {
  item: ActionItem;
  onToggleCalendar?: () => void;
};

export function FollowUpRow({ item, onToggleCalendar }: Props) {
  const hasCalendar = !!item.calendar_event_id;

  return (
    <View style={styles.row}>
      <View style={styles.dot} />
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
    </View>
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
    backgroundColor: colors.accent,
    marginRight: spacing.md,
    marginTop: 7,
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
  },
  action: {
    ...type.body,
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
    color: colors.dueText,
    backgroundColor: colors.dueBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  calBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calBtnText: {
    ...type.meta,
    color: colors.textMuted,
  },
  calBtnTextActive: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.6,
  },
});
