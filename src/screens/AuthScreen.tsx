import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, type, radii, gradients, shadows } from '../config/theme';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    const { error: authError } =
      mode === 'signIn'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setSubmitting(false);
    if (authError) setError(authError.message);
  };

  const toggleMode = () => {
    setMode(m => (m === 'signIn' ? 'signUp' : 'signIn'));
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.appName}>VoiceNote</Text>
          <Text style={styles.subtitle}>
            {mode === 'signIn'
              ? 'Οι σημειώσεις σου, πάντα κοντά σου'
              : 'Δημιούργησε τον λογαριασμό σου'}
          </Text>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.dark.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!submitting}
            />
            <TextInput
              style={styles.input}
              placeholder="Κωδικός"
              placeholderTextColor={colors.dark.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
            />

            {error != null && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !email.trim() || !password}
              style={({ pressed }) => [
                styles.btn,
                (submitting || !email.trim() || !password) && styles.btnDisabled,
                pressed && styles.btnPressed,
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
                  {mode === 'signIn' ? 'Σύνδεση' : 'Εγγραφή'}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={toggleMode} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {mode === 'signIn'
                ? 'Δεν έχετε λογαριασμό; '
                : 'Έχετε ήδη λογαριασμό; '}
              <Text style={styles.toggleTextAccent}>
                {mode === 'signIn' ? 'Εγγραφή' : 'Σύνδεση'}
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
    justifyContent: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.dark.accent,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.dark.glass,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
    borderRadius: radii.cardLg,
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.dark.glass,
    color: colors.dark.text,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.dark.borderGlass,
    marginBottom: spacing.md,
  },
  error: {
    ...type.meta,
    color: colors.dark.destructive,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  btn: {
    borderRadius: radii.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.light.button,
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.72 },
  btnFillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  btnFillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark.text,
    textAlign: 'center',
  },
  toggleBtn: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  toggleText: {
    ...type.meta,
    color: colors.dark.textMuted,
    textAlign: 'center',
  },
  toggleTextAccent: {
    color: colors.dark.accent,
    fontWeight: '700',
  },
});
