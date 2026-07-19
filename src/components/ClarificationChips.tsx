import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, type, radii } from "../config/theme";
import type { LiteralMatchCandidate } from "../types/agent";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  candidates: LiteralMatchCandidate[];
  onSelect: (candidate: LiteralMatchCandidate) => void;
  onNone: () => void;
  onRetry: () => void;
};

// Presentational only — fed entirely by props, no services/hooks/db access.
// candidates arrive already ranked (whole_word > word_prefix > mid_word) by
// db/fts.js's searchNotesLiteral, so the first entry is always the strongest
// match; only its emphasis differs here, not its position.
export function ClarificationChips({ candidates, onSelect, onNone, onRetry }: Props) {
  return (
    <View style={styles.container}>
      {candidates.map((candidate, index) => (
        <ClarificationCard
          key={candidate.noteId}
          candidate={candidate}
          index={index}
          isPrimary={index === 0}
          onSelect={onSelect}
        />
      ))}

      <View style={styles.actionsRow}>
        <Pressable testID="clarification-none" onPress={onNone}>
          {({ pressed }) => (
            <Text style={[styles.actionText, pressed && styles.actionTextPressed]}>
              Κανένα από αυτά
            </Text>
          )}
        </Pressable>
        <Pressable testID="clarification-retry" onPress={onRetry}>
          {({ pressed }) => (
            <Text style={[styles.actionText, pressed && styles.actionTextPressed]}>
              Δοκίμασε αλλιώς
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Clarification Cards Appear + Press (ANIMATION_SPEC.md CHAT): staggered
// entry (250ms, 100ms stagger) and a press scale/tint, isolated per-card so
// each candidate animates independently.
function ClarificationCard({
  candidate,
  index,
  isPrimary,
  onSelect,
}: {
  candidate: LiteralMatchCandidate;
  index: number;
  isPrimary: boolean;
  onSelect: (candidate: LiteralMatchCandidate) => void;
}) {
  const entry = useSharedValue(0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    entry.value = withDelay(
      index * 100,
      withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) })
    );
  }, [index, entry]);

  // Entrance (opacity/translateY) lives on this outer wrapper, separate from
  // the AnimatedPressable's own style below — keeps the emphasis dimming
  // (cardDimmed's static opacity) independently readable/testable.
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [{ translateY: (1 - entry.value) * 8 }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  return (
    <Animated.View style={entryStyle}>
      <AnimatedPressable
        testID={`clarification-candidate-${candidate.noteId}`}
        onPress={() => onSelect(candidate)}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 150 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 150 });
        }}
        style={[styles.card, isPrimary ? styles.cardPrimary : styles.cardDimmed, pressStyle]}
      >
        <Text style={isPrimary ? styles.snippetPrimary : styles.snippetDimmed}>
          {candidate.snippet.slice(0, candidate.matchOffset)}
          <Text style={styles.highlight}>
            {candidate.snippet.slice(candidate.matchOffset, candidate.matchOffset + candidate.matchLength)}
          </Text>
          {candidate.snippet.slice(candidate.matchOffset + candidate.matchLength)}
        </Text>
        <Text style={styles.meta}>
          {candidate.date} · {candidate.summary}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  cardPrimary: {
    backgroundColor: colors.light.bgCard,
    borderColor: colors.light.accent,
  },
  cardDimmed: {
    backgroundColor: colors.light.bgCard,
    borderColor: colors.light.border,
    opacity: 0.6,
  },
  snippetPrimary: {
    ...type.body,
    color: colors.light.text,
  },
  snippetDimmed: {
    ...type.body,
    color: colors.light.textMuted,
  },
  highlight: {
    color: colors.light.accent,
    fontWeight: "700",
  },
  meta: {
    ...type.meta,
    color: colors.light.textMuted,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    ...type.metaLarge,
    color: colors.light.accent,
    fontWeight: "600",
  },
  actionTextPressed: {
    opacity: 0.5,
  },
});
