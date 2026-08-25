import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import { toKey } from "../lib/textNormalize";
import type { TagChip } from "../types/tags";

type Props = {
  visible: boolean;
  chips: TagChip[];
  activeChip: TagChip | null;
  onSelect: (chip: TagChip | null) => void;
  onCancel: () => void;
};

// Bottom sheet replacing NoteTagFilterBar's horizontal chip strip (increment
// 3). Bare RN <Modal> (transparent, slide) — no new dependency. Presentation
// only: `chips` is fed straight from the screen's existing
// deriveTagChips(allNotesSnapshot) memo, and a row tap calls `onSelect` with
// the same TagChip | null the old chip strip produced — the screen wires
// that directly to its existing setActiveChip, so filter logic itself is
// never touched here. Backdrop tap calls `onCancel` instead: close with no
// filter change, distinct from a row's onSelect.
export function TagFilterSheet({ visible, chips, activeChip, onSelect, onCancel }: Props) {
  const [query, setQuery] = useState("");

  // Fresh filter field on every open, so a stale query from a previous
  // session never lingers into the next.
  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  // Same toKey() normalization the rest of the app uses (lib/textNormalize),
  // applied symmetrically to the query and each chip's display label —
  // matches AnimatedSearchInput's underlying FTS normalization behavior
  // without reusing that component or reimplementing normalization.
  const needle = toKey(query.trim());
  const matches = (chip: TagChip) => needle === "" || toKey(chip.label).includes(needle);

  // «Όλα» is pinned above both sections and is never subject to the text
  // filter above. A section header only renders when that section has at
  // least one row left after filtering (mirrors groupNotesByDate's
  // non-empty-bucket rule).
  const people = chips.filter((c) => c.kind === "person" && matches(c));
  const topics = chips.filter((c) => c.kind === "topic" && matches(c));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      {/* No header/nav chrome renders inside this Modal — it's a full-screen
          overlay above the entire app, not content nested under a screen
          header — so no keyboardVerticalOffset is needed (same reasoning as
          AuthScreen's KeyboardAvoidingView, which also has none; ChatScreen/
          RecordScreen only need one because they sit BELOW a real header
          within their own screen). The backdrop stays a plain absolute-fill
          sibling — ignoring the padding this adds is fine, it's just a
          static tap-catching tint, it doesn't need to track the keyboard.
          The panel below is now a normal flex child instead: overlay's
          justifyContent:"flex-end" is what re-anchors it to the bottom, and
          lets the KAV's padding actually push it up when the keyboard shows
          (an absolutely-positioned panel would ignore that padding). */}
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} testID="tag-filter-sheet-backdrop" />
        <View style={styles.sheet}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Φιλτράρισμα…"
            placeholderTextColor={colors.light.textMuted}
            returnKeyType="search"
          />
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            <FilterRow label="Όλα" selected={activeChip === null} onPress={() => onSelect(null)} />

            {people.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Άτομα</Text>
                {people.map((chip) => (
                  <FilterRow
                    key={`${chip.kind}-${chip.key}`}
                    label={chip.label}
                    selected={activeChip?.kind === chip.kind && activeChip?.key === chip.key}
                    onPress={() => onSelect(chip)}
                  />
                ))}
              </>
            )}

            {topics.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Θέματα</Text>
                {topics.map((chip) => (
                  <FilterRow
                    key={`${chip.kind}-${chip.key}`}
                    label={chip.label}
                    selected={activeChip?.kind === chip.kind && activeChip?.key === chip.key}
                    onPress={() => onSelect(chip)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Local row renderer, tightly coupled to this sheet only — same convention
// as ClarificationChips.tsx's own unexported ClarificationCard.
function FilterRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID="tag-filter-row"
    >
      <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.light.bgCard,
    borderTopLeftRadius: radii.cardLg,
    borderTopRightRadius: radii.cardLg,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.listBottomInset,
    ...shadows.light.card,
  },
  input: {
    backgroundColor: colors.light.borderLight,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.light.text,
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    ...type.label,
    color: colors.light.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderLight,
  },
  rowPressed: { opacity: 0.6 },
  rowLabel: {
    ...type.body,
    color: colors.light.text,
    flex: 1,
  },
  rowLabelSelected: {
    color: colors.light.accent,
    fontWeight: "600",
  },
  checkmark: {
    ...type.body,
    color: colors.light.accent,
    fontWeight: "700",
    marginLeft: spacing.sm,
  },
});
