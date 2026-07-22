import { useEffect, useState } from "react";
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
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useRecorder } from "../hooks/useRecorder";
import { usePipelineRun } from "../hooks/usePipelineRun";
import { useCalendarToggle } from "../hooks/useCalendarToggle";
import { NoteCard } from "../components/NoteCard";
import { PulseRings, RotatingRing } from "../components/PulseRings";
import { RecordBackgroundGlow } from "../components/RecordBackgroundGlow";
import { colors, spacing, type, radii, recordButton, gradients, shadows } from "../config/theme";
import { duration, spring, recordButtonRadius } from "../config/motion";

// Icon crossfade (ANIMATION_SPEC.md RECORD > Record Button Press / Stop
// Recording): mic<->stop, 200ms. Stays inline with the button — tightly
// coupled to isRecording, same reasoning as the morph below.
function RecordIcon({ isRecording }: { isRecording: boolean }) {
  const micOpacity = useSharedValue(isRecording ? 0 : 1);
  const stopOpacity = useSharedValue(isRecording ? 1 : 0);

  useEffect(() => {
    micOpacity.value = withTiming(isRecording ? 0 : 1, { duration: duration.base });
    stopOpacity.value = withTiming(isRecording ? 1 : 0, { duration: duration.base });
  }, [isRecording, micOpacity, stopOpacity]);

  const micStyle = useAnimatedStyle(() => ({ opacity: micOpacity.value }));
  const stopStyle = useAnimatedStyle(() => ({ opacity: stopOpacity.value }));

  return (
    <View style={styles.iconStack}>
      <Animated.View style={[styles.iconLayer, micStyle]}>
        <Ionicons name="mic" size={56} color={colors.dark.text} />
      </Animated.View>
      <Animated.View style={[styles.iconLayer, stopStyle]}>
        <Ionicons name="stop" size={56} color={colors.dark.text} />
      </Animated.View>
    </View>
  );
}

// Timer text entry (ANIMATION_SPEC.md RECORD > Recording State): opacity
// 0->1, translateY -8->0, 200ms — fires once per mount, same manual-shared-
// value technique ChatScreen's MessageBubble uses (not Reanimated's `entering`
// presets) so the -8px offset matches the spec exactly.
function RecordingTimerText({ elapsed }: { elapsed: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: duration.base, easing: Easing.out(Easing.ease) });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -8 }],
  }));

  return (
    <Animated.View style={[styles.recordingRow, style]}>
      <View style={styles.recordingDot} />
      <Text style={styles.statusText}>Εγγραφή… {elapsed}s</Text>
    </Animated.View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

export function RecordScreen({ navigation }: Props) {
  const { isRecording, elapsed, uri: recordingUri, start, stop } = useRecorder();
  const { phase, note, error, setNote, runFromUri, runFromText, reset } = usePipelineRun();
  const [showTextEntry, setShowTextEntry] = useState(false);
  const [textEntry, setTextEntry] = useState("");
  const headerHeight = useHeaderHeight();
  const handleToggleCalendar = useCalendarToggle(note, setNote);

  // Button morph (ANIMATION_SPEC.md RECORD > Record Button Press / Stop
  // Recording): borderRadius spring between idle (full circle) and
  // recording (rounded square). Stays inline — tightly coupled to
  // isRecording, shared by both the button's shadow-casting wrapper and its
  // fill-clip mask below so the two never animate out of sync.
  const morphRadius = useSharedValue(
    isRecording ? recordButtonRadius.recording : recordButtonRadius.idle
  );

  useEffect(() => {
    morphRadius.value = withSpring(
      isRecording ? recordButtonRadius.recording : recordButtonRadius.idle,
      spring.recordMorph
    );
  }, [isRecording, morphRadius]);

  const morphStyle = useAnimatedStyle(() => ({
    borderRadius: morphRadius.value,
  }));

  const handleStart = async () => {
    if (busy) return;
    reset();
    setShowTextEntry(false);
    setTextEntry("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await start();
  };

  const handleStop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            {/* Centered mic cluster — status label + hero button own the
                vertically-centered space; centerRegion's flex:1 is what makes
                that centering real (see bottomRegion below for the other half
                of the split). alignItems/justifyContent live on this wrapper,
                never on buttonStage — buttonStage's fixed 176x176 is
                load-bearing for RecordBackgroundGlow/ringLayer's absolute
                top:50%/left:50% anchoring inside it. */}
            <View style={styles.centerRegion}>
              {/* Status line */}
              <View style={styles.statusBox}>
                {isRecording ? (
                  <RecordingTimerText elapsed={elapsed} />
                ) : busy ? (
                  <>
                    <ActivityIndicator size="small" color={colors.dark.accent} style={styles.spinner} />
                    <Text style={styles.statusText}>
                      {phase === "transcribing" ? "Απομαγνητοφώνηση…" : "Δόμηση σημείωσης…"}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.statusText}>
                    {phase === "done"
                      ? "Έτοιμο"
                      : phase === "error"
                        ? "Σφάλμα"
                        : "Πάτησε για ηχογράφηση"}
                  </Text>
                )}
              </View>

              {/* Hero record button */}
              <View style={styles.buttonStage}>
                {/* Render order is the stacking order: glow (furthest back),
                    then the ring layer, then the button — all three share
                    buttonStage as their positioning parent so top:50%/left:50%
                    anchors to the button's actual center, not the screen's. */}
                <RecordBackgroundGlow isRecording={isRecording} />
                <View style={styles.ringLayer} pointerEvents="none">
                  {isRecording ? <RotatingRing /> : <PulseRings />}
                </View>
                <Animated.View
                  style={[
                    styles.buttonMorph,
                    isRecording && styles.buttonMorphRecording,
                    morphStyle,
                  ]}
                >
                  <Pressable
                    onPress={isRecording ? handleStop : handleStart}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={isRecording ? "Διακοπή ηχογράφησης" : "Έναρξη ηχογράφησης"}
                    style={({ pressed }) => [
                      styles.buttonInner,
                      pressed && styles.buttonPressed,
                      busy && styles.buttonDisabled,
                    ]}
                  >
                    <Animated.View style={[styles.buttonFillClip, morphStyle]}>
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
                    </Animated.View>
                    <RecordIcon isRecording={isRecording} />
                  </Pressable>
                </Animated.View>
              </View>
            </View>

            {/* Bottom-anchored region — sibling after centerRegion, not
                inside it: centerRegion's flex:1 leaves this pinned to the
                bottom of voiceContainer's flexGrow:1 space. voiceContainer's
                existing paddingBottom:60 is the bottom gap — do not add
                another one here, it would stack. */}
            <View style={styles.bottomRegion}>
              {/* Text entry toggle — only when idle */}
              {!isRecording && !busy && phase !== "done" && (
                <Pressable
                  onPress={() => setShowTextEntry(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Γράψε σημείωση με πληκτρολόγιο"
                  hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
                  style={({ pressed }) => [styles.textToggle, pressed && styles.buttonPressed]}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.dark.text} />
                  <Text style={styles.textToggleText}>Γράψε σημείωση</Text>
                </Pressable>
              )}

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}
            </View>

            {phase === "done" && note && (
              <Pressable
                testID="record-note-card"
                onPress={() => navigation.navigate("NoteDetail", { id: note.id })}
                style={({ pressed }) => [styles.cardWrapper, pressed && styles.buttonPressed]}
              >
                <NoteCard note={note} onToggleCalendar={handleToggleCalendar} />
              </Pressable>
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
    flexGrow: 1,
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.base,
    paddingBottom: 60,
  },
  centerRegion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRegion: {
    alignItems: "center",
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
  buttonStage: {
    width: recordButton.outerSize,
    height: recordButton.outerSize,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.lg,
  },
  ringLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  // Shadow-casting wrapper — borderRadius is animated (morphStyle), so it
  // carries no static radius of its own. Kept separate from buttonInner
  // (the Pressable) so overflow:hidden on buttonFillClip below never clips
  // this view's shadow.
  buttonMorph: {
    width: recordButton.innerSize,
    height: recordButton.innerSize,
    ...shadows.dark.fab,
  },
  buttonMorphRecording: {
    shadowColor: colors.dark.destructive,
  },
  buttonInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.4 },
  buttonFillClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  buttonFillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonFillRecording: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.dark.destructive,
  },
  iconStack: {
    width: 56,
    height: 56,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  textToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.dark.glass,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
    borderRadius: radii.pill,
  },
  textToggleText: {
    ...type.meta,
    color: colors.dark.text,
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
