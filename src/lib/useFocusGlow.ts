import { useEffect } from "react";
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotionPreference } from "./useReducedMotionPreference";

export type FocusGlowTheme = {
  restColor: string;
  focusColor: string;
  restShadowOpacity: number;
  focusShadowOpacity: number;
};

// Shared focus animation extracted from AnimatedSearchInput: border color
// crossfade + shadow-opacity fade, driven by a plain `focused` boolean so
// callers don't touch shared values directly. Kept under lib/ (not hooks/)
// so presentational components can call it directly — components may
// import lib but never hooks (AGENTS.md layer rule), same reasoning as
// useReducedMotionPreference. `durationMs` is left to the caller (its own
// semantic token, e.g. duration.searchFocus vs duration.inputFocus) rather
// than owned here, so two unrelated features never share a timing by
// accident just because they both use this hook.
export function useFocusGlow(focused: boolean, theme: FocusGlowTheme, durationMs: number) {
  const reducedMotion = useReducedMotionPreference();
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const target = focused ? 1 : 0;
    focus.value = reducedMotion ? target : withTiming(target, { duration: durationMs });
  }, [focused, reducedMotion, durationMs, focus]);

  return useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [theme.restColor, theme.focusColor]),
    shadowOpacity:
      theme.restShadowOpacity + focus.value * (theme.focusShadowOpacity - theme.restShadowOpacity),
    shadowRadius: focus.value * 8,
  }));
}
