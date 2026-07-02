import { useRef, useState, useLayoutEffect } from "react";
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
import { useAgentChat } from "../hooks/useAgentChat";
import { colors, spacing, type, radii } from "../config/theme";
import type { VisibleMessage } from "../types/agent";

export function ChatScreen() {
  const { messages, isThinking, send, clear } = useAgentChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<VisibleMessage>>(null);
  const headerHeight = useHeaderHeight();

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
            <View
              style={
                item.role === "user"
                  ? styles.bubbleUser
                  : styles.bubbleAssistant
              }
            >
              <Text
                style={
                  item.role === "user" ? styles.textUser : styles.textAssistant
                }
              >
                {item.content}
              </Text>
            </View>
          </View>
        )}
      />

      {isThinking && (
        <View style={styles.thinkingRow}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />
          <Text style={styles.thinkingText}>Σκέφτεται…</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ρώτησε κάτι…"
          placeholderTextColor={colors.textMuted}
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
          <Text style={styles.sendBtnText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bgBase },

  list: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  emptyHint: {
    ...type.meta,
    color: colors.textMuted,
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

  bubbleUser: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    maxWidth: "80%",
  },
  bubbleAssistant: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    maxWidth: "80%",
    borderWidth: 1,
    borderColor: colors.borderFaint,
  },

  textUser: {
    ...type.body,
    color: colors.bgBase,
  },
  textAssistant: {
    ...type.body,
    color: colors.textPrimary,
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
    color: colors.textMuted,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnPressed: { opacity: 0.72 },
  sendBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.bgBase,
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
    color: colors.accent,
    fontWeight: "600",
  },
});
