import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { notesRepository } from "../services/notesRepository";
import { removeReminder } from "../services/calendar";
import { cancelReminder } from "../services/notifications";
import { useCalendarToggle } from "../hooks/useCalendarToggle";
import { applyReminderDiff } from "../hooks/reminderDiff";
import { useRegenerateSummary } from "../hooks/useRegenerateSummary";
import { useNoteActionItems } from "../hooks/useNoteActionItems";
import { NoteCard } from "../components/NoteCard";
import { NoteEditForm } from "../components/NoteEditForm";
import { formatDateTime } from "../lib/dateFormat";
import type { Note, ActionItem } from "../types/note";
import { copyNote } from "../types/note";
import { colors, spacing, type, radii, shadows } from "../config/theme";

type Props = NativeStackScreenProps<RootStackParamList, "NoteDetail">;
type Mode = "view" | "edit" | "transcript";

export function NoteDetailScreen({ route, navigation }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Note | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");

  useEffect(() => {
    (async () => {
      const found = await notesRepository.get(route.params.id);
      if (found) {
        setNote(found);
        navigation.setOptions({ title: formatDateTime(found.timestamp) });
      }
    })();
  }, [route.params.id]);

  // Must be called before the early return so the hooks run unconditionally.
  const handleToggleCalendar = useCalendarToggle(note, setNote);
  const { regenerating, regenerate } = useRegenerateSummary(note, setNote);
  const { completeItem, deleteItem } = useNoteActionItems(note, setNote);

  if (!note) return null;

  const enterEdit = () => {
    setDraft(copyNote(note));
    setMode("edit");
  };

  const saveEdit = async () => {
    if (!draft) return;
    const diff = await notesRepository.save(draft);
    await applyReminderDiff(diff, draft.id);
    setNote(draft);
    setDraft(null);
    setMode("view");
  };

  const cancelEdit = () => {
    setDraft(null);
    setMode("view");
  };

  const updateDraft = (updater: (d: Note) => Note) => {
    setDraft((prev) => (prev ? updater(prev) : null));
  };

  const handleDelete = () => {
    Alert.alert("Διαγραφή σημείωσης;", undefined, [
      { text: "Άκυρο", style: "cancel" },
      {
        text: "Διαγραφή",
        style: "destructive",
        onPress: async () => {
          const reminders = await notesRepository.delete(note.id);
          for (const r of reminders) {
            if (r.calendarEventId) await removeReminder(r.calendarEventId);
            if (r.notificationId) await cancelReminder(r.notificationId);
          }
          navigation.goBack();
        },
      },
    ]);
  };

  const enterTranscript = () => {
    setTranscriptDraft(note.transcript);
    setMode("transcript");
  };

  const cancelTranscript = () => {
    setTranscriptDraft("");
    setMode("view");
  };

  const handleRegenerate = () => {
    Alert.alert(
      "Ενημέρωση περίληψης",
      "Η περίληψη και οι ετικέτες θα ενημερωθούν από το νέο κείμενο. Οι εργασίες δεν επηρεάζονται. Συνέχεια;",
      [
        { text: "Άκυρο", style: "cancel" },
        {
          text: "Ενημέρωση",
          style: "destructive",
          onPress: async () => {
            try {
              await regenerate(transcriptDraft);
              setTranscriptDraft("");
              setMode("view");
            } catch {
              // Alert already shown by useRegenerateSummary
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >

      {/* ── VIEW ─────────────────────────────────────────────────── */}
      {mode === "view" && (
        <>
          <NoteCard
            note={note}
            onToggleCalendar={handleToggleCalendar}
            onCompleteActionItem={completeItem}
            onDeleteActionItem={deleteItem}
          />
          <View style={styles.viewActions}>
            <Pressable
              testID="note-detail-edit"
              onPress={enterEdit}
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            >
              <Text style={styles.editBtnText}>Επεξεργασία</Text>
            </Pressable>
            <Pressable
              testID="note-detail-transcript"
              onPress={enterTranscript}
              style={({ pressed }) => [styles.regenLink, pressed && styles.pressed]}
            >
              <Text style={styles.regenLinkText}>Επεξεργασία κειμένου</Text>
            </Pressable>
            <Pressable
              testID="note-detail-delete"
              onPress={handleDelete}
              style={({ pressed }) => [styles.regenLink, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLinkText}>Διαγραφή</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── EDIT ─────────────────────────────────────────────────── */}
      {mode === "edit" && draft && (
        <>
          <View style={styles.card}>
            <NoteEditForm
              draft={draft}
              onSummaryChange={(s) => updateDraft((d) => ({ ...d, summary: s }))}
              onActionItemChange={(i, item: ActionItem) =>
                updateDraft((d) => {
                  const items = [...d.action_items];
                  items[i] = item;
                  return { ...d, action_items: items };
                })
              }
              onActionItemDelete={(i) =>
                updateDraft((d) => ({
                  ...d,
                  action_items: d.action_items.filter((_, idx) => idx !== i),
                }))
              }
              onActionItemAdd={() =>
                updateDraft((d) => ({
                  ...d,
                  action_items: [...d.action_items, { text: "", due_date: null }],
                }))
              }
              onPersonRemove={(i) =>
                updateDraft((d) => ({
                  ...d,
                  people: d.people.filter((_, idx) => idx !== i),
                }))
              }
              onPersonAdd={(p) =>
                updateDraft((d) => ({ ...d, people: [...d.people, p] }))
              }
              onTopicRemove={(i) =>
                updateDraft((d) => ({
                  ...d,
                  topics: d.topics.filter((_, idx) => idx !== i),
                }))
              }
              onTopicAdd={(t) =>
                updateDraft((d) => ({ ...d, topics: [...d.topics, t] }))
              }
            />
          </View>
          <View style={styles.editActions}>
            <Pressable
              testID="note-detail-save"
              onPress={saveEdit}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Αποθήκευση</Text>
            </Pressable>
            <Pressable
              onPress={cancelEdit}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Άκυρο</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── TRANSCRIPT RE-GENERATE ───────────────────────────────── */}
      {mode === "transcript" && (
        <>
          <Text style={styles.transcriptHeading}>Επεξεργασία απομαγνητοφώνησης</Text>
          <TextInput
            testID="note-detail-transcript-input"
            style={styles.transcriptInput}
            value={transcriptDraft}
            onChangeText={setTranscriptDraft}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.light.textMuted}
            placeholder="Κείμενο απομαγνητοφώνησης…"
          />
          <Text style={styles.transcriptWarning}>
            Θα ενημερωθούν μόνο η περίληψη και οι ετικέτες. Οι εργασίες παραμένουν όπως είναι.
          </Text>
          {regenerating ? (
            <ActivityIndicator
              size="small"
              color={colors.light.accent}
              style={styles.regeneratingSpinner}
            />
          ) : (
            <View style={styles.editActions}>
              <Pressable
                testID="note-detail-regenerate"
                onPress={handleRegenerate}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Ενημέρωση περίληψης</Text>
              </Pressable>
              <Pressable
                onPress={cancelTranscript}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>Άκυρο</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.bg },
  container: {
    padding: spacing.base,
    paddingBottom: spacing.listBottomInset,
  },
  viewActions: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  editBtn: {
    width: "100%",
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: colors.light.text,
  },
  regenLink: {
    paddingVertical: spacing.sm,
  },
  regenLinkText: {
    ...type.meta,
    color: colors.light.textMuted,
  },
  deleteLinkText: {
    ...type.meta,
    color: colors.light.destructive,
    opacity: 0.6,
  },
  card: {
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.cardSm,
    padding: spacing.lg,
    ...shadows.light.card,
  },
  editActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.light.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: colors.light.textOnDark,
  },
  secondaryBtn: {
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: colors.light.text,
  },
  transcriptHeading: {
    ...type.label,
    color: colors.light.text,
    marginBottom: spacing.md,
  },
  transcriptInput: {
    ...type.body,
    color: colors.light.text,
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    minHeight: 220,
  },
  transcriptWarning: {
    ...type.meta,
    color: colors.light.destructive,
    marginTop: spacing.md,
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
  regeneratingSpinner: { marginTop: spacing.xl },
});
