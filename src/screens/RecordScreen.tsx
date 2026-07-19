import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useRecorder } from "../hooks/useRecorder";
import { usePipelineRun } from "../hooks/usePipelineRun";
import { useCalendarToggle } from "../hooks/useCalendarToggle";
import { NoteCard } from "../components/NoteCard";
import { colors, spacing, type, radii, recordButton, gradients, shadows } from "../config/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

export function RecordScreen({ navigation }: Props) {
  const { isRecording, elapsed, uri: recordingUri, start, stop } = useRecorder();
  const { phase, note, error, setNote, runFromUri, runFromText, reset } = usePipelineRun();
  const [showTextEntry, setShowTextEntry] = useState(false);
  const [textEntry, setTextEntry] = useState("");
  const headerHeight = useHeaderHeight();
  const handleToggleCalendar = useCalendarToggle(note, setNote);

  const handleStart = async () => {
    reset();
    setShowTextEntry(false);
    setTextEntry("");
    await start();
  };

  const handleStop = async () => {
    await stop();
    if (!recordingUri) return;
    await runFromUri(recordingUri);
  };

  const handleTextBuild = async () => {
    const trimmed = textEntry.trim();
    if (!trimmed) return;
    await runFromText(trimmed);
    setShowTextEntry(false);
    setTextEntry("");
  };

  const busy = phase === "transcribing" || phase === "extracting";

  return (
    <LinearGradient
      colors={gradients.recordScreen.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
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
                  <ActivityIndicator size="small" color={colors.dark.accent} style={styles.spinner} />
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
                <View style={styles.buttonFillClip}>
                  {isRecording ? (
                    <View style={styles.buttonFillRecording} />
                  ) : (
                    <LinearGradient
                      colors={gradients.recordButton.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buttonFillGradient}
                    />
                  )}
                </View>
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={56}
                  color={colors.dark.text}
                />
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
                <ActivityIndicator size="small" color={colors.dark.accent} />
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
                  placeholderTextColor={colors.dark.textMuted}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },

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
    backgroundColor: colors.dark.destructive,
    marginRight: spacing.sm,
  },
  spinner: { marginRight: spacing.sm },
  statusText: {
    ...type.metaLarge,
    color: colors.dark.textMuted,
  },
  buttonRing: {
    width: recordButton.outerSize,
    height: recordButton.outerSize,
    borderRadius: recordButton.outerRadius,
    borderWidth: 1.5,
    borderColor: colors.dark.accent + "30",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.lg,
  },
  buttonRingRecording: {
    borderColor: colors.dark.destructive + "40",
  },
  button: {
    width: recordButton.innerSize,
    height: recordButton.innerSize,
    borderRadius: recordButton.innerRadius,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.dark.fab,
  },
  buttonRecording: {
    shadowColor: colors.dark.destructive,
  },
  buttonPressed: { opacity: 0.72 },
  buttonFillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: recordButton.innerRadius,
    overflow: "hidden",
  },
  buttonFillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonFillRecording: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.dark.destructive,
  },
  textToggle: { paddingVertical: spacing.sm },
  textToggleText: {
    ...type.meta,
    color: colors.dark.textMuted,
  },
  errorText: {
    ...type.meta,
    color: colors.dark.destructive,
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
    color: colors.dark.text,
    backgroundColor: colors.dark.glass,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
  },
  textModeActions: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buildBtn: {
    backgroundColor: colors.dark.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buildBtnDisabled: { opacity: 0.4 },
  buildBtnText: {
    ...type.buttonSmall,
    color: colors.dark.text,
  },
  cancelLink: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.dark.glass,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
    borderRadius: radii.pill,
  },
  cancelLinkText: {
    ...type.meta,
    color: colors.dark.text,
  },
});
