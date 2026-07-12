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
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, type, radii } from '../config/theme';

type AuthScreenProps = {
  // TEMP DIAGNOSTIC — remove after TestFlight root-cause is confirmed.
  authError?: string | null;
};

export function AuthScreen({ authError }: AuthScreenProps) {
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
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.appName}>VoiceNote</Text>

        {/* TEMP DIAGNOSTIC — remove after TestFlight root-cause is confirmed. */}
        {authError != null && (
          <Text style={styles.debugAuthError}>[debug] auth init: {authError}</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
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
          placeholderTextColor={colors.textMuted}
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
          {submitting ? (
            <ActivityIndicator color={colors.bgBase} />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'signIn' ? 'Σύνδεση' : 'Εγγραφή'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={toggleMode} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>
            {mode === 'signIn'
              ? 'Δεν έχετε λογαριασμό; Εγγραφή'
              : 'Έχετε ήδη λογαριασμό; Σύνδεση'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  input: {
    backgroundColor: colors.bgElevated,
    color: colors.textPrimary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  error: {
    ...type.meta,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  // TEMP DIAGNOSTIC — remove after TestFlight root-cause is confirmed.
  debugAuthError: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.72 },
  btnText: {
    ...type.buttonHero,
    color: colors.bgBase,
  },
  toggleBtn: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  toggleText: {
    ...type.meta,
    color: colors.textMuted,
  },
});
