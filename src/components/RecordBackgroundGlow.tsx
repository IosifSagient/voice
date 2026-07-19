import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../config/theme";
import { duration, recordGlow } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

type Props = { isRecording: boolean };

// Presentational only. Idle: slow breathing loop. Recording: one-shot
// intensify ramp (ANIMATION_SPEC.md RECORD has no continuous loop for the
// recording state, only the ramp) — the breathing loop resumes once
// isRecording goes false again.
export function RecordBackgroundGlow({ isRecording }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const opacity = useSharedValue(recordGlow.idleOpacityFrom);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = recordGlow.idleOpacityFrom;
      return;
    }

    if (isRecording) {
      opacity.value = withTiming(recordGlow.recordingOpacityTo, {
        duration: duration.glowIntensify,
      });
      return () => cancelAnimation(opacity);
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(recordGlow.idleOpacityTo, {
          duration: duration.glowBreathe / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(recordGlow.idleOpacityFrom, {
          duration: duration.glowBreathe / 2,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1
    );
    return () => cancelAnimation(opacity);
  }, [isRecording, reducedMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View pointerEvents="none" style={[styles.glow, style]} />;
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: recordGlow.size,
    height: recordGlow.size,
    marginLeft: -recordGlow.size / 2,
    marginTop: -recordGlow.size / 2,
    borderRadius: recordGlow.size / 2,
    backgroundColor: colors.dark.accent,
  },
});
