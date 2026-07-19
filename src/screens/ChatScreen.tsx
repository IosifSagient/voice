import { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
import { useAgentChat } from "../hooks/useAgentChat";
import { ClarificationChips } from "../components/ClarificationChips";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import type { VisibleMessage, LiteralMatchCandidate } from "../types/agent";

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
          <ActivityIndicator
            size="small"
            color={colors.light.accent}
          />
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
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || isThinking}
          style={({ pressed }) => [
            styles.sendBtn,
            (!input.trim() || isThinking) && styles.sendBtnDisabled,
            pressed && styles.sendBtnPressed,
          ]}
        >
          <LinearGradient
            colors={colors.light.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendBtnGradient}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </LinearGradient>
        </Pressable>
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
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnPressed: { opacity: 0.72 },
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
