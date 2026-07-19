import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../hooks/useAuth";
import { AnimatedAuthInput } from "../components/AnimatedAuthInput";
import { LogoFloat } from "../components/LogoFloat";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";
import {
  colors,
  spacing,
  type,
  radii,
  gradients,
  shadows,
} from "../config/theme";
import { duration, spring, authButtonShadow } from "../config/motion";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reducedMotion = useReducedMotionPreference();
  const btnScale = useSharedValue(1);
  const btnShadowOpacity = useSharedValue(authButtonShadow.restOpacity);

  // ANIMATION_SPEC.md LOGIN/REGISTER > Button Press: scale 1.0 -> 0.96 on
  // press-in, spring back on release; shadow intensity decreases on press.
  // Reduced motion keeps the scale (a discrete press/release transition,
  // not a loop) but skips the shadow change, per the spec's reduced-motion
  // note — so shadow opacity is only ever touched when !reducedMotion.
  const handleBtnPressIn = () => {
    btnScale.value = withTiming(0.96, { duration: duration.instant });
    if (!reducedMotion) {
      btnShadowOpacity.value = withTiming(authButtonShadow.pressOpacity, {
        duration: duration.instant,
      });
    }
  };
  const handleBtnPressOut = () => {
    btnScale.value = withSpring(1, spring.authButtonPress);
    if (!reducedMotion) {
      btnShadowOpacity.value = withTiming(authButtonShadow.restOpacity, {
        duration: duration.instant,
      });
    }
  };
  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    shadowOpacity: reducedMotion ? authButtonShadow.restOpacity : btnShadowOpacity.value,
  }));

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    const { error: authError } =
      mode === "signIn"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setSubmitting(false);
    if (authError) setError(authError.message);
  };

  const toggleMode = () => {
    setMode((m) => (m === "signIn" ? "signUp" : "signIn"));
    setError(null);
  };

  return (
    <LinearGradient
      colors={gradients.auth.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.35, y: 1 }}
      style={styles.root}
    >
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <LogoFloat>
            <Text style={styles.appName}>Hey Lisa</Text>
          </LogoFloat>
          <Text style={styles.subtitle}>
            {mode === "signIn"
              ? "Οι σημειώσεις σου, πάντα κοντά σου"
              : "Δημιούργησε τον λογαριασμό σου"}
          </Text>

          <View style={styles.card}>
            <AnimatedAuthInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!submitting}
            />
            <AnimatedAuthInput
              placeholder="Κωδικός"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={
                mode === "signUp" ? "new-password" : "current-password"
              }
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
            />

            {error != null && <Text style={styles.error}>{error}</Text>}

            <Animated.View style={[styles.btnShadowWrapper, btnAnimatedStyle]}>
              <Pressable
                onPress={handleSubmit}
                onPressIn={handleBtnPressIn}
                onPressOut={handleBtnPressOut}
                disabled={submitting || !email.trim() || !password}
                style={[
                  styles.btn,
                  (submitting || !email.trim() || !password) &&
                    styles.btnDisabled,
                ]}
              >
                <View style={styles.btnFillClip}>
                  <LinearGradient
                    colors={gradients.authButton.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnFillGradient}
                  />
                </View>
                {submitting ? (
                  <ActivityIndicator color={colors.dark.text} />
                ) : (
                  <Text style={styles.btnText}>
                    {mode === "signIn" ? "Σύνδεση" : "Εγγραφή"}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          </View>

          <Pressable
            onPress={toggleMode}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>
              {mode === "signIn"
                ? "Δεν έχετε λογαριασμό; "
                : "Έχετε ήδη λογαριασμό; "}
              <Text style={styles.toggleTextAccent}>
                {mode === "signIn" ? "Εγγραφή" : "Σύνδεση"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.dark.accent,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.dark.textMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.dark.glass,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
    borderRadius: radii.cardLg,
    padding: spacing.lg,
  },
  error: {
    ...type.meta,
    color: colors.dark.destructive,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  // Shadow lives on this outer wrapper (not `btn` below) because
  // shadowOpacity is animated on press — see btnAnimatedStyle. shadowColor/
  // Offset/Radius/elevation stay static, only opacity moves.
  btnShadowWrapper: {
    borderRadius: radii.lg,
    marginTop: spacing.sm,
    shadowColor: shadows.light.button.shadowColor,
    shadowOffset: shadows.light.button.shadowOffset,
    shadowRadius: shadows.light.button.shadowRadius,
    elevation: shadows.light.button.elevation,
  },
  btn: {
    borderRadius: radii.lg,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnFillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  btnFillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.dark.text,
    textAlign: "center",
  },
  toggleBtn: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  toggleText: {
    ...type.meta,
    color: colors.dark.textMuted,
    textAlign: "center",
  },
  toggleTextAccent: {
    color: colors.dark.accent,
    fontWeight: "700",
  },
});
