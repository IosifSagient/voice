import { Text, StyleSheet } from "react-native";
import { colors, radii, type } from "../config/theme";

type Props = {
  label: string;
  variant: "person" | "topic";
};

export function Tag({ label, variant }: Props) {
  return (
    <Text style={[styles.base, styles[variant]]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...type.meta,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  person: {
    color: colors.light.accent,
    backgroundColor: colors.light.accentFaint,
  },
  topic: {
    color: colors.light.textMuted,
    backgroundColor: colors.light.borderLight,
  },
});
