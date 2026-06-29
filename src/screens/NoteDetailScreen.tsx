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
import { ensurePermission, addReminder, removeReminder } from "../services/calendar";
import { extractNote } from "../services/extraction";
import { NoteCard } from "../components/NoteCard";
import { NoteEditForm } from "../components/NoteEditForm";
import { formatDateTime } from "../lib/dateFormat";
import type { Note, ActionItem } from "../types/note";
import { colors, spacing, type, radii } from "../config/theme";

type Props = NativeStackScreenProps<RootStackParamList, "NoteDetail">;
type Mode = "view" | "edit" | "transcript";

function copyNote(n: Note): Note {
  return {
    ...n,
    action_items: n.action_items.map((item) => ({ ...item })),
    people: [...n.people],
    topics: [...n.topics],
    products: [...n.products],
    companies: [...n.companies],
    decisions: [...n.decisions],
  };
}

export function NoteDetailScreen({ route, navigation }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Note | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const found = await notesRepository.get(route.params.id);
      if (found) {
        setNote(found);
        navigation.setOptions({ title: formatDateTime(found.timestamp) });
      }
    })();
  }, [route.params.id]);

  if (!note) return null;

  const handleToggleCalendar = async (itemId: string, currentEventId: string | null) => {
    if (currentEventId) {
      await removeReminder(currentEventId);
      await notesRepository.setCalendarEvent(itemId, null);
      setNote((prev) =>
        prev
          ? {
              ...prev,
              action_items: prev.action_items.map((it) =>
                it.id === itemId ? { ...it, calendar_event_id: null } : it
              ),
            }
          : null
      );
    } else {
      const granted = await ensurePermission();
      if (!granted) {
        Alert.alert("Ημερολόγιο", "Χρειάζεται πρόσβαση στο ημερολόγιο για να προσθέσεις υπενθύμιση.");
        return;
      }
      const item = note.action_items.find((it) => it.id === itemId);
      if (!item?.due_date) return;
      const eventId = await addReminder({
        text: item.text,
        due_date: item.due_date,
        due_time: item.due_time,
        all_day: item.all_day,
      });
      if (!eventId) return;
      await notesRepository.setCalendarEvent(itemId, eventId);
      setNote((prev) =>
        prev
          ? {
              ...prev,
              action_items: prev.action_items.map((it) =>
                it.id === itemId ? { ...it, calendar_event_id: eventId } : it
              ),
            }
          : null
      );
    }
  };

  const enterEdit = () => {
    setDraft(copyNote(note));
    setMode("edit");
  };

  const saveEdit = async () => {
    if (!draft) return;
    await notesRepository.save(draft);
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
        onPress: async () => { await notesRepository.delete(note.id); navigation.goBack(); },
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
      "Ξαναδημιουργία σημείωσης",
      "Αυτό θα αντικαταστήσει την τρέχουσα σημείωση. Συνέχεια;",
      [
        { text: "Άκυρο", style: "cancel" },
        {
          text: "Ξαναδημιουργία",
          style: "destructive",
          onPress: async () => {
            setRegenerating(true);
            try {
              const extracted = await extractNote(transcriptDraft);
              const updated: Note = { ...note, transcript: transcriptDraft, ...extracted };
              await notesRepository.save(updated);
              setNote(updated);
              setTranscriptDraft("");
              setMode("view");
            } catch (e: any) {
              Alert.alert("Σφάλμα", e.message ?? String(e));
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>

      {/* ── VIEW ─────────────────────────────────────────────────── */}
      {mode === "view" && (
        <>
          <NoteCard note={note} onToggleCalendar={handleToggleCalendar} />
          <View style={styles.viewActions}>
            <Pressable
              onPress={enterEdit}
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            >
              <Text style={styles.editBtnText}>Επεξεργασία</Text>
            </Pressable>
            <Pressable
              onPress={enterTranscript}
              style={({ pressed }) => [styles.regenLink, pressed && styles.pressed]}
            >
              <Text style={styles.regenLinkText}>Ξαναδημιουργία από το κείμενο</Text>
            </Pressable>
            <Pressable
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
            style={styles.transcriptInput}
            value={transcriptDraft}
            onChangeText={setTranscriptDraft}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            placeholder="Κείμενο απομαγνητοφώνησης…"
          />
          <Text style={styles.transcriptWarning}>
            Η επανεκτέλεση θα αντικαταστήσει πλήρως την τρέχουσα σημείωση.
          </Text>
          {regenerating ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={{ marginTop: spacing.xl }}
            />
          ) : (
            <View style={styles.editActions}>
              <Pressable
                onPress={handleRegenerate}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Ξαναδημιουργία</Text>
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
  screen: { flex: 1, backgroundColor: colors.bgBase },
  container: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  viewActions: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  editBtn: {
    width: "100%",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: {
    ...type.buttonSmall,
    color: colors.textPrimary,
  },
  regenLink: {
    paddingVertical: spacing.sm,
  },
  regenLinkText: {
    ...type.meta,
    color: colors.textMuted,
  },
  deleteLinkText: {
    ...type.meta,
    color: colors.error,
    opacity: 0.6,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  editActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: {
    ...type.buttonSmall,
    color: colors.bgBase,
  },
  secondaryBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    ...type.buttonSmall,
    color: colors.textSecondary,
  },
  transcriptHeading: {
    ...type.label,
    marginBottom: spacing.md,
  },
  transcriptInput: {
    ...type.body,
    color: colors.textSecondary,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 220,
  },
  transcriptWarning: {
    ...type.meta,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
});
