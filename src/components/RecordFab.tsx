import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing, type } from "../config/theme";
import { duration, fabShadow, spring } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

type Props = {
  onPress: () => void;
  // 0 = hidden, 1 = shown — driven by the screen's scroll handler, so scroll
  // position never round-trips through React state (see NotesListScreen).
  visible: SharedValue<number>;
};

// ANIMATION_SPEC.md NOTES > FAB. Presentational only — idle shadow pulse and
// press-scale live entirely here (same pattern as PulseRings /
// RecordBackgroundGlow); scroll show/hide is driven by the `visible` shared
// value the screen owns and passes in.
export function RecordFab({ onPress, visible }: Props) {
  const reducedMotion = useReducedMotionPreference();
  const pressScale = useSharedValue(1);
  const shadowRadius = useSharedValue(fabShadow.radiusFrom);
  const shadowOpacity = useSharedValue(fabShadow.opacityFrom);

  useEffect(() => {
    if (reducedMotion) return;

    // reverse:true (3rd arg) — see PulseRings for why: without it the loop
    // snaps back to the start value each cycle instead of animating through it.
    shadowRadius.value = withRepeat(
      withTiming(fabShadow.radiusTo, {
        duration: duration.fabShadowPulse,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    shadowOpacity.value = withRepeat(
      withTiming(fabShadow.opacityTo, {
        duration: duration.fabShadowPulse,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(shadowRadius);
      cancelAnimation(shadowOpacity);
    };
  }, [reducedMotion, shadowRadius, shadowOpacity]);

  const handlePressIn = () => {
    pressScale.value = withTiming(0.96, { duration: duration.instant });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, spring.fabPress);
  };

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : visible.value,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - visible.value) * 80 },
      { scale: pressScale.value },
    ],
    shadowRadius: shadowRadius.value,
    shadowOpacity: shadowOpacity.value,
  }));

  return (
    <Animated.View
      style={[styles.wrapper, wrapperStyle]}
      pointerEvents="box-none"
    >
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient
          colors={colors.light.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}
        >
          <Ionicons name="mic-outline" size={20} color={colors.light.textOnDark} />
          <Text style={styles.label}>Νέα σημείωση</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: spacing.base,
    bottom: spacing.xl,
    borderRadius: radii.full,
    ...shadows.dark.fab,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    gap: spacing.sm,
    overflow: "hidden",
  },
  label: {
    ...type.buttonSmall,
    color: colors.light.textOnDark,
  },
});
