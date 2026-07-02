import { View, Text, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import { colors, spacing, type, radii } from '../config/theme';

type Props = {
  lockAvailable: boolean;
  lockEnabled: boolean;
  onSetLockEnabled: (enabled: boolean) => void;
  onSignOut: () => void;
};

export function SettingsScreen({
  lockAvailable,
  lockEnabled,
  onSetLockEnabled,
  onSignOut,
}: Props) {
  function handleSignOut() {
    Alert.alert('Αποσύνδεση;', undefined, [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Αποσύνδεση', style: 'destructive', onPress: onSignOut },
    ]);
  }

  return (
    <View style={styles.container}>
      {lockAvailable && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Face ID / Κωδικός</Text>
            <Switch
              value={lockEnabled}
              onValueChange={onSetLockEnabled}
              trackColor={{ false: colors.border, true: colors.accentMuted }}
              thumbColor={lockEnabled ? colors.accent : colors.textMuted}
            />
          </View>
          <Text style={styles.rowHint}>
            Απαιτεί επαλήθευση κατά την επιστροφή στην εφαρμογή.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.signOutText}>Αποσύνδεση</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingTop: spacing.lg,
  },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
  },
  rowLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  rowHint: {
    ...type.meta,
    color: colors.textMuted,
    paddingBottom: spacing.base,
  },
  signOutBtn: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.72 },
  signOutText: {
    ...type.body,
    color: colors.error,
    fontWeight: '600',
  },
});
