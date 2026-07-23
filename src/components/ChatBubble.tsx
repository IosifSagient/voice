import { memo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import type { VisibleMessage } from "../types/agent";

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

type Props = {
  role: VisibleMessage["role"];
  content: string;
  onLongPress?: (text: string) => void;
};

function ChatBubbleImpl({ role, content, onLongPress }: Props) {
  return (
    <MessageBubble role={role}>
      <Pressable testID="chat-bubble-pressable" onLongPress={() => onLongPress?.(content)}>
        {role === "user" ? (
          <LinearGradient
            colors={colors.light.gradientUserBubble}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleUser}
          >
            <Text style={styles.textUser}>{content}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.bubbleAssistant}>
            <Text style={styles.textAssistant}>{content}</Text>
          </View>
        )}
      </Pressable>
    </MessageBubble>
  );
}

// renderItem in ChatScreen currently re-renders every mounted row on each
// keystroke, because `input` is screen-level state there. Memoizing here
// keeps a keystroke from re-running this component's render/animation setup
// for rows whose role/content haven't changed.
export const ChatBubble = memo(ChatBubbleImpl);

const styles = StyleSheet.create({
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
});
