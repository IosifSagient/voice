import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Note } from "../types/note";
import { FollowUpRow } from "./FollowUpRow";
import { Tag } from "./Tag";
import { colors, spacing, type, radii } from "../config/theme";

type Props = {
  note: Note;
  onToggleCalendar?: (itemId: string, currentEventId: string | null) => void;
  onCompleteActionItem?: (itemId: string) => void;
  onDeleteActionItem?: (itemId: string) => void;
};

export function NoteCard({ note, onToggleCalendar, onCompleteActionItem, onDeleteActionItem }: Props) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <View style={styles.card}>
      {note.summary ? (
        <Text style={styles.summary}>{note.summary}</Text>
      ) : null}

      {note.action_items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ενέργειες</Text>
          {note.action_items.map((item, i) => (
            <FollowUpRow
              key={item.id ?? i}
              item={item}
              onToggleCalendar={
                onToggleCalendar && item.id
                  ? () => onToggleCalendar(item.id!, item.calendar_event_id ?? null)
                  : undefined
              }
              onComplete={
                onCompleteActionItem && item.id
                  ? () => onCompleteActionItem(item.id!)
                  : undefined
              }
              onDelete={
                onDeleteActionItem && item.id
                  ? () => onDeleteActionItem(item.id!)
                  : undefined
              }
            />
          ))}
        </View>
      )}

      {note.decisions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Αποφάσεις</Text>
          {note.decisions.map((d, i) => (
            <Text key={i} style={styles.decisionText}>• {d}</Text>
          ))}
        </View>
      )}

      {(note.people.length > 0 || note.topics.length > 0) && (
        <View style={styles.tagsRow}>
          {note.people.map((p, i) => (
            <Tag key={`pe-${i}`} label={p} variant="person" />
          ))}
          {note.topics.map((t, i) => (
            <Tag key={`to-${i}`} label={t} variant="topic" />
          ))}
        </View>
      )}

      {note.transcript ? (
        <>
          <View style={styles.divider} />
          <Pressable
            onPress={() => setShowTranscript((v) => !v)}
            style={({ pressed }) => [styles.transcriptToggle, pressed && styles.transcriptTogglePressed]}
          >
            <Text style={styles.transcriptToggleText}>
              {showTranscript ? "Απόκρυψη απομαγνητοφώνησης" : "Εμφάνιση απομαγνητοφώνησης"}
            </Text>
          </Pressable>
          {showTranscript ? (
            <Text style={styles.transcriptText}>{note.transcript}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  summary: {
    ...type.headline,
    marginBottom: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...type.label,
    marginBottom: spacing.md,
  },
  decisionText: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  transcriptToggle: {
    paddingVertical: spacing.sm,
  },
  transcriptTogglePressed: {
    opacity: 0.6,
  },
  transcriptToggleText: {
    ...type.metaLarge,
    color: colors.textMuted,
  },
  transcriptText: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
