import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { transcribe } from "../services/transcription";
import { extractNote } from "../services/extraction";
import { saveNote, getNote, setActionCalendarEvent } from "../db";
import { ensurePermission, addReminder, removeReminder } from "../services/calendar";
import { NoteCard } from "../components/NoteCard";
import type { Note } from "../types/note";
import { colors, spacing, type, radii, recordButton } from "../config/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

type Phase = "idle" | "transcribing" | "extracting" | "done" | "error";

export function RecordScreen({ navigation }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTextEntry, setShowTextEntry] = useState(false);
  const [textEntry, setTextEntry] = useState("");
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission needed", "Microphone access denied.");
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  useEffect(() => {
    if (!recorderState.isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recorderState.isRecording]);

  const handleStart = async () => {
    setNote(null);
    setError(null);
    setPhase("idle");
    setShowTextEntry(false);
    setTextEntry("");
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const handleStop = async () => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError("No recording URI");
      setPhase("error");
      return;
    }
    try {
      setPhase("transcribing");
      const text = await transcribe(uri);
      setPhase("extracting");
      const extracted = await extractNote(text);
      const noteId = await saveNote(extracted, text);
      const saved = await getNote(noteId);
      setNote(saved);
      setPhase("done");
    } catch (e: any) {
      setError(e.message ?? String(e));
      setPhase("error");
    }
  };

  const handleTextBuild = async () => {
    const trimmed = textEntry.trim();
    if (!trimmed) return;
    setNote(null);
    setError(null);
    try {
      setPhase("extracting");
      const extracted = await extractNote(trimmed);
      const noteId = await saveNote(extracted, trimmed);
      const saved = await getNote(noteId);
      setNote(saved);
      setPhase("done");
      setShowTextEntry(false);
      setTextEntry("");
    } catch (e: any) {
      setError(e.message ?? String(e));
      setPhase("error");
    }
  };

  const handleToggleCalendar = async (itemId: string, currentEventId: string | null) => {
    if (currentEventId) {
      await removeReminder(currentEventId);
      await setActionCalendarEvent(itemId, null);
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
      const item = note?.action_items.find((it) => it.id === itemId);
      if (!item?.due_date) return;
      const eventId = await addReminder({
        text: item.text,
        due_date: item.due_date,
        due_time: item.due_time,
        all_day: item.all_day,
      });
      if (!eventId) return;
      await setActionCalendarEvent(itemId, eventId);
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

  const isRecording = recorderState.isRecording;
  const busy = phase === "transcribing" || phase === "extracting";

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {/* ── VOICE MODE ──────────────────────────────────────────── */}
      {!showTextEntry && (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.voiceContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status line */}
          <View style={styles.statusBox}>
            {isRecording ? (
              <>
                <View style={styles.recordingDot} />
                <Text style={styles.statusText}>Εγγραφή… {elapsed}s</Text>
              </>
            ) : busy ? (
              <>
                <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
                <Text style={styles.statusText}>
                  {phase === "transcribing" ? "Απομαγνητοφώνηση…" : "Δόμηση σημείωσης…"}
                </Text>
              </>
            ) : (
              <Text style={styles.statusText}>
                {phase === "done" ? "Έτοιμο" : phase === "error" ? "Σφάλμα" : "Έτοιμος"}
              </Text>
            )}
          </View>

          {/* Hero record button */}
          <View style={[styles.buttonRing, isRecording && styles.buttonRingRecording]}>
            <Pressable
              onPress={isRecording ? handleStop : handleStart}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                isRecording && styles.buttonRecording,
                (pressed || busy) && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>{isRecording ? "Stop" : "Record"}</Text>
            </Pressable>
          </View>

          {/* Text entry toggle — only when idle */}
          {!isRecording && !busy && phase !== "done" && (
            <Pressable
              onPress={() => setShowTextEntry(true)}
              style={({ pressed }) => [styles.textToggle, pressed && styles.buttonPressed]}
            >
              <Text style={styles.textToggleText}>ή γράψε τη σημείωση</Text>
            </Pressable>
          )}

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {note && (
            <View style={styles.cardWrapper}>
              <NoteCard note={note} onToggleCalendar={handleToggleCalendar} />
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TEXT MODE ───────────────────────────────────────────── */}
      {showTextEntry && (
        <View style={styles.textModeContainer}>
          {busy ? (
            <View style={styles.textModeBusy}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.statusText}>Δόμηση σημείωσης…</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.textInput}
                value={textEntry}
                onChangeText={setTextEntry}
                multiline
                scrollEnabled
                autoFocus
                textAlignVertical="top"
                placeholder="Γράψε τη σημείωσή σου εδώ…"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.textModeActions}>
                <Pressable
                  onPress={handleTextBuild}
                  disabled={!textEntry.trim()}
                  style={({ pressed }) => [
                    styles.buildBtn,
                    !textEntry.trim() && styles.buildBtnDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.buildBtnText}>Δόμηση</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowTextEntry(false); setTextEntry(""); }}
                  style={({ pressed }) => [styles.cancelLink, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.cancelLinkText}>Άκυρο</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bgBase },

  // ── Voice mode ──────────────────────────────────────────────────
  screen: { flex: 1 },
  voiceContainer: {
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.base,
    paddingBottom: 60,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 22,
    marginBottom: spacing.xl,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.recording,
    marginRight: spacing.sm,
  },
  spinner: { marginRight: spacing.sm },
  statusText: {
    ...type.metaLarge,
    color: colors.textSecondary,
  },
  buttonRing: {
    width: recordButton.outerSize,
    height: recordButton.outerSize,
    borderRadius: recordButton.outerRadius,
    borderWidth: 1.5,
    borderColor: colors.accent + "30",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.lg,
  },
  buttonRingRecording: {
    borderColor: colors.recording + "40",
  },
  button: {
    width: recordButton.innerSize,
    height: recordButton.innerSize,
    borderRadius: recordButton.innerRadius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonRecording: {
    backgroundColor: colors.recording,
    shadowColor: colors.recording,
  },
  buttonPressed: { opacity: 0.72 },
  buttonText: { ...type.buttonHero },
  textToggle: { paddingVertical: spacing.sm },
  textToggleText: {
    ...type.meta,
    color: colors.textMuted,
  },
  errorText: {
    ...type.meta,
    color: colors.error,
    marginTop: spacing.xl,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  cardWrapper: {
    width: "100%",
    marginTop: spacing.xxl,
  },

  // ── Text mode ───────────────────────────────────────────────────
  textModeContainer: {
    flex: 1,
    padding: spacing.base,
    paddingBottom: spacing.base,
  },
  textModeBusy: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  textInput: {
    ...type.body,
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textModeActions: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buildBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buildBtnDisabled: { opacity: 0.4 },
  buildBtnText: {
    ...type.buttonSmall,
    color: colors.bgBase,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  cancelLinkText: {
    ...type.meta,
    color: colors.textMuted,
  },
});
