import { useState } from "react";
import { TextInput, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import type { TextInputProps } from "react-native";
import { colors, radii, spacing } from "../config/theme";
import { duration } from "../config/motion";
import { useFocusGlow } from "../lib/useFocusGlow";

type Props = Pick<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "returnKeyType"
>;

// ANIMATION_SPEC.md NOTES (HOME) > Search bar focus: borderColor transition
// to accent + inner glow via shadow, 200ms. The animation itself lives in
// useFocusGlow (src/lib), shared with AnimatedAuthInput — this component
// just supplies the light-theme colors and the Notes-specific duration
// token, so its own external behavior (props, rendered output) is unchanged
// from before the extraction.
const FOCUS_THEME = {
  restColor: colors.light.borderGlass,
  focusColor: colors.light.accentMint,
  restShadowOpacity: 0,
  focusShadowOpacity: 0.35,
};

export function AnimatedSearchInput({ value, onChangeText, placeholder, returnKeyType }: Props) {
  const [focused, setFocused] = useState(false);
  const wrapperStyle = useFocusGlow(focused, FOCUS_THEME, duration.searchFocus);

  return (
    <Animated.View style={[styles.wrapper, wrapperStyle]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.light.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        clearButtonMode="while-editing"
        returnKeyType={returnKeyType}
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
  },
  input: {
    backgroundColor: colors.light.glassLight,
    color: colors.light.textOnDark,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 11,
    fontSize: 15,
  },
});
