import { memo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, type, radii, shadows } from "../config/theme";
import type { VisibleMessage } from "../types/agent";

// react-native-markdown-display's `body` style targets its outer View
// container (layout only) — text never renders through it, so the base
// typography has to live on `textgroup` instead, the Text wrapper each
// paragraph's inline runs actually render into. strong/em explicitly
// clear the library's default fontWeight ('bold') by overriding it to
// undefined: with named-weight font files (see theme.ts's type.* comment),
// any fontWeight alongside a specific font family makes Android synthesize
// a wrong-looking weight on top of the loaded file, so bold/italic must
// come from a font-family swap, never fontWeight/fontStyle-on-top-of-weight.
const markdownStyles = {
  textgroup: {
    ...type.body,
    color: colors.text,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  strong: {
    fontFamily: "Inter_600SemiBold",
    // eslint-disable-next-line no-restricted-syntax -- sanctioned exception: clears the markdown lib's default bold, not a real weight
    fontWeight: undefined,
  },
  em: {
    fontFamily: "Inter_400Regular",
    fontStyle: "italic" as const,
  },
  bullet_list: {
    marginBottom: spacing.xs,
  },
  list_item: {
    marginBottom: spacing.xs,
  },
  bullet_list_icon: {
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
  },
};

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
            colors={colors.gradientUserBubble}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleUser}
          >
            <Text style={styles.textUser}>{content}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.bubbleAssistant}>
            <Markdown style={markdownStyles}>{content}</Markdown>
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
    backgroundColor: colors.bgCard,
    borderRadius: radii.bubble,
    borderBottomLeftRadius: radii.bubbleTail,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    ...shadows.light.card,
  },

  textUser: {
    ...type.body,
    color: colors.white,
  },
});
