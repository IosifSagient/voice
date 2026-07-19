import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { Note, ActionItem } from "../types/note";
import { colors, spacing, type, radii } from "../config/theme";

type Props = {
  draft: Note;
  onSummaryChange: (s: string) => void;
  onActionItemChange: (i: number, item: ActionItem) => void;
  onActionItemDelete: (i: number) => void;
  onActionItemAdd: () => void;
  onPersonRemove: (i: number) => void;
  onPersonAdd: (p: string) => void;
  onTopicRemove: (i: number) => void;
  onTopicAdd: (t: string) => void;
};

export function NoteEditForm({
  draft,
  onSummaryChange,
  onActionItemChange,
  onActionItemDelete,
  onActionItemAdd,
  onPersonRemove,
  onPersonAdd,
  onTopicRemove,
  onTopicAdd,
}: Props) {
  const [newPerson, setNewPerson] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const commitPerson = () => {
    const t = newPerson.trim();
    if (t) { onPersonAdd(t); setNewPerson(""); }
  };
  const commitTopic = () => {
    const t = newTopic.trim();
    if (t) { onTopicAdd(t); setNewTopic(""); }
  };

  return (
    <View>
      {/* Summary */}
      <Text style={styles.label}>Σύνοψη</Text>
      <TextInput
        style={styles.summaryInput}
        value={draft.summary}
        onChangeText={onSummaryChange}
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.light.textMuted}
        placeholder="Σύνοψη σημείωσης…"
      />

      {/* Action items */}
      <Text style={[styles.label, styles.sectionGap]}>Ενέργειες</Text>
      {draft.action_items.map((item, i) => (
        <View key={i} style={styles.followUpRow}>
          <View style={styles.dot} />
          <View style={styles.followUpFields}>
            <TextInput
              style={styles.actionInput}
              value={item.text}
              onChangeText={(text) => onActionItemChange(i, { ...item, text })}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.light.textMuted}
              placeholder="Ενέργεια…"
            />
            <TextInput
              style={styles.dueInput}
              value={item.due_date ?? ""}
              onChangeText={(text) => onActionItemChange(i, { ...item, due_date: text || null })}
              placeholderTextColor={colors.light.textMuted}
              placeholder="Προθεσμία (YYYY-MM-DD, προαιρετικό)"
            />
          </View>
          <Pressable
            onPress={() => onActionItemDelete(i)}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={styles.deleteBtnText}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={onActionItemAdd}
        style={({ pressed }) => [styles.addLink, pressed && styles.pressed]}
      >
        <Text style={styles.addLinkText}>+ Νέα ενέργεια</Text>
      </Pressable>

      {/* People */}
      <Text style={[styles.label, styles.sectionGap]}>Άτομα</Text>
      {draft.people.length > 0 && (
        <View style={styles.tagsRow}>
          {draft.people.map((p, i) => (
            <Pressable
              key={i}
              onPress={() => onPersonRemove(i)}
              style={({ pressed }) => [styles.chip, styles.personChip, pressed && styles.pressed]}
            >
              <Text style={styles.personChipText}>{p} ×</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.addTagRow}>
        <TextInput
          style={styles.tagInput}
          value={newPerson}
          onChangeText={setNewPerson}
          placeholderTextColor={colors.light.textMuted}
          placeholder="Προσθήκη ατόμου…"
          onSubmitEditing={commitPerson}
          returnKeyType="done"
        />
        <Pressable
          onPress={commitPerson}
          style={({ pressed }) => [styles.addTagBtn, pressed && styles.pressed]}
        >
          <Text style={styles.addLinkText}>+</Text>
        </Pressable>
      </View>

      {/* Topics */}
      <Text style={[styles.label, styles.sectionGap]}>Θέματα</Text>
      {draft.topics.length > 0 && (
        <View style={styles.tagsRow}>
          {draft.topics.map((t, i) => (
            <Pressable
              key={i}
              onPress={() => onTopicRemove(i)}
              style={({ pressed }) => [styles.chip, styles.topicChip, pressed && styles.pressed]}
            >
              <Text style={styles.topicChipText}>{t} ×</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.addTagRow}>
        <TextInput
          style={styles.tagInput}
          value={newTopic}
          onChangeText={setNewTopic}
          placeholderTextColor={colors.light.textMuted}
          placeholder="Προσθήκη θέματος…"
          onSubmitEditing={commitTopic}
          returnKeyType="done"
        />
        <Pressable
          onPress={commitTopic}
          style={({ pressed }) => [styles.addTagBtn, pressed && styles.pressed]}
        >
          <Text style={styles.addLinkText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.label,
    color: colors.light.textMuted,
    marginBottom: spacing.sm,
  },
  sectionGap: {
    marginTop: spacing.xl,
  },
  summaryInput: {
    ...type.headline,
    color: colors.light.text,
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    minHeight: 72,
  },
  followUpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.accent,
    marginRight: spacing.md,
    marginTop: 11,
  },
  followUpFields: {
    flex: 1,
    gap: spacing.xs,
  },
  actionInput: {
    ...type.body,
    color: colors.light.text,
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.light.border,
    textAlignVertical: "top",
  },
  dueInput: {
    ...type.meta,
    color: colors.light.textMuted,
    backgroundColor: colors.light.borderLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  deleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingTop: 2,
  },
  deleteBtnText: {
    fontSize: 20,
    lineHeight: 26,
    color: colors.light.textMuted,
  },
  addLink: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  addLinkText: {
    ...type.meta,
    color: colors.light.accent,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  personChip: {
    backgroundColor: colors.light.accentFaint,
  },
  personChipText: {
    ...type.meta,
    color: colors.light.accent,
  },
  topicChip: {
    backgroundColor: colors.light.borderLight,
  },
  topicChipText: {
    ...type.meta,
    color: colors.light.textMuted,
  },
  addTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tagInput: {
    ...type.meta,
    flex: 1,
    color: colors.light.text,
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  addTagBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.6 },
});
