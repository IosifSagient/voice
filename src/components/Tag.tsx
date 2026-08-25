import { Text, Pressable, StyleSheet } from "react-native";
import { colors, radii, type } from "../config/theme";

type Props = {
  label: string;
  variant: "person" | "topic";
  onPress?: () => void;
  selected?: boolean;
};

// Display-only by default (NoteCard.tsx's two call sites pass neither prop
// and must stay non-interactive). Becomes a pressable, selectable chip only
// when a caller supplies onPress — used by NoteTagFilterBar for the
// notes-list tag filter.
export function Tag({ label, variant, onPress, selected }: Props) {
  const text = (
    <Text style={[styles.base, styles[variant], selected && styles.selected]}>
      {label}
    </Text>
  );

  if (!onPress) return text;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {text}
    </Pressable>
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
  selected: {
    color: colors.light.textOnDark,
    backgroundColor: colors.light.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
