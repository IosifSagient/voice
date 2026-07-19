import { useEffect, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, radii, spacing } from "../config/theme";
import { duration, spring } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Feather-style "check" path (20,6 -> 9,17 -> 4,12), total stroke length
// ~22.6 — rounded up so strokeDashoffset can fully hide the stroke at rest.
const CHECK_PATH = "M20 6L9 17l-5-5";
const CHECK_PATH_LENGTH = 23;

type Props = { done: boolean; onToggle: () => void; checkboxTestID?: string };

// Presentational only — shared values and the SVG checkmark live entirely
// here; TaskRow only passes `done`/`onToggle`/`checkboxTestID`.
//
// `checkboxTestID` (not `testID`) is deliberate: react-test-renderer's
// findByProps does a shallow match and stops at the first node whose props
// contain the queried key. If this component's own prop were also named
// `testID`, its composite fiber (props.testID set, but no onPress) would
// shadow the inner Pressable that actually has the handler — renaming
// avoids that collision so the query only ever matches the real Pressable.
export function TaskCheckbox({ done, onToggle, checkboxTestID }: Props) {
  const reducedMotion = useReducedMotionPreference();

  const containerScale = useSharedValue(1);
  const fillScale = useSharedValue(done ? 1 : 0);
  const strokeOffset = useSharedValue(done ? 0 : CHECK_PATH_LENGTH);
  const checkmarkOpacity = useSharedValue(done ? 1 : 0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The shared values above already initialize to the correct resting
    // state for whatever `done` is on mount — skip animating into it so an
    // already-completed task (initial list load, filter switch, FlatList
    // recycling a row) doesn't replay the bounce/fill/stroke every mount.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (reducedMotion) {
      // Immediate state change, no animation — same end values, no timing.
      fillScale.value = done ? 1 : 0;
      strokeOffset.value = done ? 0 : CHECK_PATH_LENGTH;
      checkmarkOpacity.value = done ? 1 : 0;
      containerScale.value = 1;
      return;
    }

    if (done) {
      // Fill and bounce start together (different targets: inner circle vs.
      // container); stroke draw is withDelay'd off checkboxFill's duration,
      // not a parallel withTiming that happens to line up on paper.
      fillScale.value = withTiming(1, { duration: duration.checkboxFill });
      checkmarkOpacity.value = 1;
      strokeOffset.value = withDelay(
        duration.checkboxFill,
        withTiming(0, { duration: duration.checkboxStroke })
      );
      containerScale.value = withSequence(
        withTiming(0.85, { duration: duration.instant }),
        withSpring(1.15, spring.checkboxBounceDown),
        withSpring(1.0, spring.checkboxBounceSettle)
      );
    } else {
      fillScale.value = withTiming(0, { duration: duration.checkboxUnfill });
      checkmarkOpacity.value = withTiming(0, { duration: duration.checkboxCheckmarkFadeOut });
      strokeOffset.value = CHECK_PATH_LENGTH;
      // No bounce on un-complete.
    }
  }, [done, reducedMotion, fillScale, strokeOffset, checkmarkOpacity, containerScale]);

  const handlePress = () => {
    if (!done && !reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fillScale.value }],
  }));
  const checkmarkStyle = useAnimatedStyle(() => ({
    opacity: checkmarkOpacity.value,
  }));
  const strokeAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeOffset.value,
  }));

  return (
    <Pressable onPress={handlePress} hitSlop={8} testID={checkboxTestID}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Fill renders first so it paints beneath the checkmark SVG. */}
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[styles.checkmark, checkmarkStyle]}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <AnimatedPath
              d={CHECK_PATH}
              stroke={colors.light.textOnDark}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={CHECK_PATH_LENGTH}
              animatedProps={strokeAnimatedProps}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.light.accent,
    backgroundColor: colors.light.accentFaint,
    marginRight: spacing.md,
    marginTop: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.light.accent,
    borderRadius: radii.full,
  },
  checkmark: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
