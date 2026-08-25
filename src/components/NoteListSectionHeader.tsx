import { Text, StyleSheet } from "react-native";
import { colors, spacing, type } from "../config/theme";

type Props = {
  label: string;
};

export function NoteListSectionHeader({ label }: Props) {
  return <Text style={styles.header}>{label}</Text>;
}

const styles = StyleSheet.create({
  header: {
    ...type.label,
    color: colors.light.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
