import { useState } from "react";
import { TextInput, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import type { TextInputProps } from "react-native";
import { colors, radii, spacing } from "../config/theme";
import { duration } from "../config/motion";
import { useFocusGlow } from "../lib/useFocusGlow";

type Props = Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "returnKeyType"
  | "secureTextEntry"
  | "autoCapitalize"
  | "keyboardType"
  | "autoComplete"
  | "editable"
  | "onSubmitEditing"
>;

// ANIMATION_SPEC.md LOGIN/REGISTER > Input Focus: border color
// rgba(255,255,255,0.15) -> rgba(52,211,153,0.5), 200ms. Dark-screen
// counterpart to AnimatedSearchInput; both call the shared useFocusGlow
// hook (src/lib) so the animation isn't duplicated, only themed
// differently. focusColor below is colors.light.accentMint (#34D399) at
// 50% alpha — the spec's literal rgba value, borrowed from the mint accent
// rather than colors.dark.accent, since that's the exact color the spec
// calls for on this dark screen.
const FOCUS_THEME = {
  restColor: colors.dark.borderGlass,
  focusColor: "rgba(52,211,153,0.5)",
  restShadowOpacity: 0,
  focusShadowOpacity: 0.35,
};

export function AnimatedAuthInput({
  value,
  onChangeText,
  placeholder,
  returnKeyType,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoComplete,
  editable,
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);
  const wrapperStyle = useFocusGlow(focused, FOCUS_THEME, duration.inputFocus);

  return (
    <Animated.View style={[styles.wrapper, wrapperStyle]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.dark.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        editable={editable}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    borderWidth: 1,
    shadowColor: colors.light.accentMint,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.dark.glass,
    color: colors.dark.text,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    fontSize: 15,
  },
});
