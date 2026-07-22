import { useEffect, useRef } from "react";
import type { PropsWithChildren } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { spring, tabIconScale } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

type Props = PropsWithChildren<{ focused: boolean }>;

// Drop-in wrapper around a tabBarIcon's rendered icon element — renders
// `children` unchanged inside an Animated.View, so appearance at rest is
// pixel-identical to rendering the icon directly.
//
// ANIMATION_SPEC.md GLOBAL > Tab Bar > Icon: "active icon scales
// 1.0->1.1->1.0 on tap, 200ms spring". tabBarIcon only exposes `focused`
// (no tap event), so this pops on `focused` transitioning false -> true
// (becoming the active tab), not on every tap — see caller for the known
// gap where re-tapping an already-active tab won't retrigger the pop.
export function AnimatedTabIcon({ focused, children }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const scale = useSharedValue(1);
  const isFirstRender = useRef(true);
  const wasFocused = useRef(focused);

  useEffect(() => {
    // Skip animating on mount — see TaskCheckbox/TaskRow for the same
    // reasoning (don't replay on initial render).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      wasFocused.current = focused;
      return;
    }

    const becameFocused = focused && !wasFocused.current;
    wasFocused.current = focused;
    if (!becameFocused) return;

    if (reducedMotion) {
      scale.value = 1;
      return;
    }

    scale.value = withSequence(
      withSpring(tabIconScale, spring.tabIconPop),
      withSpring(1, spring.tabIconPop)
    );
  }, [focused, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
