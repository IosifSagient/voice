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

// ANIMATION_SPEC.md LOGIN/REGISTER > Input Focus: border color transitions
// to the accent on focus, 200ms. Dark-screen counterpart to
// AnimatedSearchInput; both call the shared useFocusGlow hook (src/lib) so
// the animation isn't duplicated, only themed differently. Matches
// AnimatedSearchInput's pattern exactly: focusColor is a solid token
// (interpolateColor handles the crossfade), the fade-in itself comes from
// shadowOpacity animating 0 -> 0.35 below, not from alpha baked into the color.
const FOCUS_THEME = {
  restColor: colors.inverseBorderGlass,
  focusColor: colors.accentVivid,
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
        placeholderTextColor={colors.inverseTextMuted}
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
    shadowColor: colors.accentVivid,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.inverseGlass,
    color: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    fontSize: 15,
  },
});
