import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radii } from '../config/theme';

type Props = {
  onUnlock: () => void;
};

// Presentational: useAppLock decides when to auto-prompt, since mounting here
// can happen while the app is backgrounded.
export function LockScreen({ onUnlock }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.appName}>VoiceNote</Text>
      <Ionicons
        name="lock-closed"
        size={48}
        color={colors.inverseTextMuted}
        style={styles.icon}
      />
      <Pressable
        onPress={onUnlock}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>Ξεκλείδωμα</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    color: colors.accentVivid,
    marginBottom: spacing.lg,
  },
  icon: {
    marginBottom: spacing.xxxl,
  },
  btn: {
    backgroundColor: colors.accentVivid,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.72 },
  btnText: {
    ...type.buttonHero,
    color: colors.inverseBg,
  },
});
