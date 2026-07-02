import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radii } from '../config/theme';

type Props = {
  onUnlock: () => void;
};

export function LockScreen({ onUnlock }: Props) {
  // Auto-trigger biometric prompt on mount
  useEffect(() => {
    onUnlock();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>VoiceNote</Text>
      <Ionicons
        name="lock-closed"
        size={48}
        color={colors.textMuted}
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
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.accent,
    marginBottom: spacing.lg,
  },
  icon: {
    marginBottom: spacing.xxxl,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.72 },
  btnText: {
    ...type.buttonHero,
    color: colors.bgBase,
  },
});
