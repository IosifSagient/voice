import { useEffect, useRef, useState } from "react";
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAgentChat } from "../hooks/useAgentChat";
import { ClarificationChips } from "../components/ClarificationChips";
import { ThinkingDots } from "../components/ThinkingDots";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import type { VisibleMessage, LiteralMatchCandidate } from "../types/agent";

// Message Appear (ANIMATION_SPEC.md CHAT): slide in from the side the role
// speaks from, 300ms ease-out. Runs once per mount, driven directly (not via
// Reanimated's built-in SlideIn presets) so the 40px offset matches spec
// exactly instead of the presets' full-width default.
function MessageBubble({ role, children }: { role: VisibleMessage["role"]; children: React.ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * (role === "user" ? 40 : -40) }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

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

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={styles.topBar}>
        <Pressable onPress={clear}>
          <Text style={styles.clearText}>New Chat</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
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
        renderItem={({ item }) => (
          <View
            style={item.role === "user" ? styles.rowUser : styles.rowAssistant}
          >
            <View style={styles.turnColumn}>
              <MessageBubble role={item.role}>
                {item.role === "user" ? (
                  <LinearGradient
                    colors={colors.light.gradientUserBubble}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bubbleUser}
                  >
                    <Text style={styles.textUser}>{item.content}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.bubbleAssistant}>
                    <Text style={styles.textAssistant}>{item.content}</Text>
                  </View>
                )}
              </MessageBubble>
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
        )}
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

  bubbleUser: {
    borderRadius: radii.bubble,
    borderBottomRightRadius: radii.bubbleTail,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    ...shadows.light.bubbleUser,
  },
  bubbleAssistant: {
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.bubble,
    borderBottomLeftRadius: radii.bubbleTail,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    ...shadows.light.card,
  },

  textUser: {
    ...type.body,
    color: colors.light.textOnDark,
  },
  textAssistant: {
    ...type.body,
    color: colors.light.text,
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
