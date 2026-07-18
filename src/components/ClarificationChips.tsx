import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, type, radii } from "../config/theme";
import type { LiteralMatchCandidate } from "../types/agent";

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
        <Pressable
          key={candidate.noteId}
          testID={`clarification-candidate-${candidate.noteId}`}
          onPress={() => onSelect(candidate)}
          style={({ pressed }) => [
            styles.card,
            index === 0 ? styles.cardPrimary : styles.cardDimmed,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={index === 0 ? styles.snippetPrimary : styles.snippetDimmed}>
            {candidate.snippet.slice(0, candidate.matchOffset)}
            <Text style={styles.highlight}>
              {candidate.snippet.slice(candidate.matchOffset, candidate.matchOffset + candidate.matchLength)}
            </Text>
            {candidate.snippet.slice(candidate.matchOffset + candidate.matchLength)}
          </Text>
          <Text style={styles.meta}>
            {candidate.date} · {candidate.summary}
          </Text>
        </Pressable>
      ))}

      <View style={styles.actionsRow}>
        <Pressable testID="clarification-none" onPress={onNone}>
          <Text style={styles.actionText}>Κανένα από αυτά</Text>
        </Pressable>
        <Pressable testID="clarification-retry" onPress={onRetry}>
          <Text style={styles.actionText}>Δοκίμασε αλλιώς</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  cardPrimary: {
    backgroundColor: colors.bgCard,
    borderColor: colors.accent,
  },
  cardDimmed: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderFaint,
    opacity: 0.6,
  },
  cardPressed: {
    opacity: 0.72,
  },
  snippetPrimary: {
    ...type.body,
    color: colors.textPrimary,
  },
  snippetDimmed: {
    ...type.body,
    color: colors.textSecondary,
  },
  highlight: {
    color: colors.accent,
    fontWeight: "700",
  },
  meta: {
    ...type.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    ...type.meta,
    color: colors.accent,
    fontWeight: "600",
  },
});
