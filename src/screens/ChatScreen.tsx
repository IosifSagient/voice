import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAgentChat } from "../hooks/useAgentChat";
import { useMessageActions } from "../hooks/useMessageActions";
import { ChatBubble } from "../components/ChatBubble";
import { ClarificationChips } from "../components/ClarificationChips";
import { ThinkingDots } from "../components/ThinkingDots";
import { Snackbar } from "../components/Snackbar";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import type { VisibleMessage, LiteralMatchCandidate } from "../types/agent";

// Send Button (ANIMATION_SPEC.md CHAT): disabled↔enabled opacity/scale spring,
// press dip + arrow shoot-up on release.
function SendButton({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const enabledProgress = useSharedValue(enabled ? 1 : 0);
  const pressScale = useSharedValue(1);
  const arrowY = useSharedValue(0);

  useEffect(() => {
    enabledProgress.value = withSpring(enabled ? 1 : 0, { damping: 15, stiffness: 180 });
  }, [enabled, enabledProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + enabledProgress.value * 0.65,
    transform: [{ scale: (0.9 + enabledProgress.value * 0.1) * pressScale.value }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowY.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.85, { duration: 100 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 12 });
    arrowY.value = withSequence(withTiming(-3, { duration: 80 }), withSpring(0, { damping: 10 }));
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      onPressIn={enabled ? handlePressIn : undefined}
      onPressOut={enabled ? handlePressOut : undefined}
    >
      <Animated.View style={[styles.sendBtn, containerStyle]}>
        <LinearGradient
          colors={colors.light.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendBtnGradient}
        >
          <Animated.Text style={[styles.sendBtnText, arrowStyle]}>↑</Animated.Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function ChatScreen() {
  const { messages, isThinking, send, clear } = useAgentChat();
  const { onLongPress, snackbarVisible, dismissSnackbar } = useMessageActions();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<VisibleMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const headerHeight = useHeaderHeight();

  const handleSelectCandidate = (candidate: LiteralMatchCandidate) => {
    send(`Εννοώ αυτή τη σημείωση: «${candidate.summary}» (${candidate.date})`);
  };
  const handleNoneOfThese = () => {
    send("Καμία από αυτές.");
  };
  const handleRetryDifferently = () => {
    inputRef.current?.focus();
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput("");
    send(text);
  };

  const renderItem = useCallback(
    ({ item }: { item: VisibleMessage }) => (
      <View
        style={item.role === "user" ? styles.rowUser : styles.rowAssistant}
      >
        <View style={styles.turnColumn}>
          <ChatBubble role={item.role} content={item.content} onLongPress={onLongPress} />
          {item.role === "assistant" && item.clarification && (
            <ClarificationChips
              candidates={item.clarification.candidates}
              onSelect={handleSelectCandidate}
              onNone={handleNoneOfThese}
              onRetry={handleRetryDifferently}
            />
          )}
        </View>
      </View>
    ),
    [handleSelectCandidate, handleNoneOfThese, handleRetryDifferently, onLongPress]
  );

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={styles.topBar}>
        <Pressable onPress={clear}>
          <Text style={styles.clearText}>Νέα συνομιλία</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        // Index-based keys are only safe while this list is append-only —
        // switch to a stable message id before any action can delete, retry,
        // or reorder messages.
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Ρώτησε με για τις σημειώσεις σου — π.χ. «Τι έχω να κάνω αυτή την
            εβδομάδα;»
          </Text>
        }
        renderItem={renderItem}
      />

      {isThinking && (
        <View style={styles.thinkingRow}>
          <ThinkingDots />
          <Text style={styles.thinkingText}>Σκέφτεται…</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ρώτησε κάτι…"
          placeholderTextColor={colors.light.textMuted}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
          editable={!isThinking}
        />
        <SendButton enabled={!!input.trim() && !isThinking} onPress={handleSend} />
      </View>

      {/* Anchored via `top`, not `bottom` — a `bottom` inset on an absolute
          child of KeyboardAvoidingView is measured against its fixed outer
          height and ignores the paddingBottom it adds for the keyboard (see
          Phase 2C), so it wouldn't move as the keyboard raises/lowers. `top`
          has no such issue: KeyboardAvoidingView's top edge/padding never
          changes for the keyboard, so this stays put regardless of keyboard
          state. Declared last so it paints above FlatList's content without
          needing zIndex — later JSX siblings paint on top of earlier ones. */}
      <View pointerEvents="box-none" style={styles.snackbarFloat}>
        <Snackbar
          visible={snackbarVisible}
          message="Αντιγράφηκε"
          durationMs={1800}
          onDismiss={dismissSnackbar}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.light.bg },

  list: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  emptyHint: {
    ...type.meta,
    color: colors.light.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.xxl,
    marginTop: 60,
  },

  rowUser: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.sm,
  },
  rowAssistant: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: spacing.sm,
  },
  turnColumn: {
    maxWidth: "80%",
  },

  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  thinkingText: {
    ...type.meta,
    color: colors.light.textMuted,
  },

  // top/left/right all reuse spacing.base — left/right match inputRow's own
  // paddingHorizontal (same horizontal inset already used elsewhere in this
  // file); top gives the same breathing room below the nav header that
  // topBar's own paddingTop/paddingHorizontal already establish.
  snackbarFloat: {
    position: "absolute",
    top: spacing.base,
    left: spacing.base,
    right: spacing.base,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.bgCard,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.light.text,
    backgroundColor: colors.light.bg,
    borderRadius: radii.inputPill,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    marginBottom: 1,
    ...shadows.light.button,
  },
  sendBtnGradient: {
    flex: 1,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.light.textOnDark,
    lineHeight: 22,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  clearText: {
    ...type.meta,
    color: colors.light.accentMint,
    fontWeight: "600",
  },
});
