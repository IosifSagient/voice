import { ScrollView, StyleSheet } from "react-native";
import type { TagChip } from "../types/tags";
import { FilterChip } from "./FilterChip";
import { spacing } from "../config/theme";

type Props = {
  chips: TagChip[];
  activeChip: TagChip | null;
  onPress: (chip: TagChip) => void;
};

// Presentational only: renders the tag/person chips derived from the
// all-notes snapshot (NotesListScreen owns that derivation + the active-chip
// state). Purely a horizontal, single-select row over whatever chips it's
// given — it doesn't know about notes, search, or filtering.
export function NoteTagFilterBar({ chips, activeChip, onPress }: Props) {
  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.bar}
    >
      {chips.map((chip) => (
        <FilterChip
          key={`${chip.kind}-${chip.key}`}
          label={chip.label}
          variant={chip.kind}
          selected={activeChip?.kind === chip.kind && activeChip?.key === chip.key}
          onPress={() => onPress(chip)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0 },
  container: {
    flexDirection: "row",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
});
