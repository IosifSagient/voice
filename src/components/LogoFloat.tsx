import { useEffect } from "react";
import type { ReactNode } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { duration } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

type Props = { children: ReactNode };

// ANIMATION_SPEC.md LOGIN/REGISTER > Logo Float: translateY 0 -> -6 -> 0,
// 4000ms ease-in-out, infinite loop. reverse:true (3rd withRepeat arg) —
// same reason as PulseRings/RecordFab: without it the loop resets to 0 at
// each cycle boundary instead of animating back through it, so it would
// snap instead of floating smoothly. Wraps whatever children it's given
// (here, the "Hey Lisa" Text) rather than owning any text/logo asset itself.
export function LogoFloat({ children }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    translateY.value = withRepeat(
      withTiming(-6, { duration: duration.logoFloat / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    return () => cancelAnimation(translateY);
  }, [reducedMotion, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
