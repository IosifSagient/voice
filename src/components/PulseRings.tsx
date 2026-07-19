import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, recordButton } from "../config/theme";
import { duration, pulseRing, ringStagger } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

// Presentational only — no props besides isRecording. RecordScreen swaps
// PulseRings <-> RotatingRing (this file's other export) by conditional
// render in the same slot, so React unmounts one before mounting the other;
// each ring's own cleanup (cancelAnimation) therefore always finishes before
// the other's loop starts — no separate coordination needed in the screen.
function Ring({ delay }: { delay: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(pulseRing.opacityFrom);

  useEffect(() => {
    // reverse:true (3rd arg) — without it, withRepeat resets to the
    // *original* starting value at each cycle boundary instead of animating
    // back through it, so scale/opacity snap instead of smoothly pulsing.
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(pulseRing.scaleTo, { duration: duration.ringPulse }), -1, true)
    );
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(pulseRing.opacityTo, { duration: duration.ringPulse }), -1, true)
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [delay, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, style]} />;
}

export function PulseRings() {
  const reducedMotion = useReducedMotionPreference();

  if (reducedMotion) {
    return <View style={[styles.ring, styles.reducedMotionRing]} />;
  }

  return (
    <>
      <Ring delay={0} />
      <Ring delay={ringStagger} />
      <Ring delay={ringStagger * 2} />
    </>
  );
}

export function RotatingRing() {
  const reducedMotion = useReducedMotionPreference();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    rotation.value = withRepeat(
      withTiming(360, { duration: duration.rotatingRing, easing: Easing.linear }),
      -1
    );

    return () => cancelAnimation(rotation);
  }, [reducedMotion, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return <Animated.View style={[styles.rotatingRing, style]} />;
}

// Explicit top:50%/left:50% + negative half-dimension margin, not bare
// `position:"absolute"` with no insets — the latter depends on Yoga's
// alignment-based placement for absolute children with no top/left/right/
// bottom, a fragile pattern to build on. This matches the technique
// RecordBackgroundGlow already uses.
const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: recordButton.outerSize,
    height: recordButton.outerSize,
    marginLeft: -recordButton.outerSize / 2,
    marginTop: -recordButton.outerSize / 2,
    borderRadius: recordButton.outerRadius,
    borderWidth: 1.5,
    borderColor: colors.dark.accent,
  },
  reducedMotionRing: {
    opacity: pulseRing.opacityFrom,
  },
  rotatingRing: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: recordButton.outerSize,
    height: recordButton.outerSize,
    marginLeft: -recordButton.outerSize / 2,
    marginTop: -recordButton.outerSize / 2,
    borderRadius: recordButton.outerRadius,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: colors.dark.destructive,
  },
});
