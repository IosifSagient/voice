import { View, Text, Pressable, Switch, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radii } from '../config/theme';
import type { CalendarOption } from '../types/calendar';

type Props = {
  lockAvailable: boolean;
  lockEnabled: boolean;
  onSetLockEnabled: (enabled: boolean) => void;
  onSignOut: () => void;
  calendarLoading: boolean;
  calendarPermissionGranted: boolean;
  calendarCanAskAgain: boolean;
  calendars: CalendarOption[];
  selectedCalendarId: string | null;
  calendarRePickNeeded: boolean;
  onRequestCalendarPermission: () => void;
  onSelectCalendar: (id: string) => void;
  notificationLoading: boolean;
  notificationPermissionGranted: boolean;
  notificationCanAskAgain: boolean;
  onRequestNotificationPermission: () => void;
};

export function SettingsScreen({
  lockAvailable,
  lockEnabled,
  onSetLockEnabled,
  onSignOut,
  calendarLoading,
  calendarPermissionGranted,
  calendarCanAskAgain,
  calendars,
  selectedCalendarId,
  calendarRePickNeeded,
  onRequestCalendarPermission,
  onSelectCalendar,
  notificationLoading,
  notificationPermissionGranted,
  notificationCanAskAgain,
  onRequestNotificationPermission,
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
        <Text style={styles.sectionLabel}>Ημερολόγιο</Text>

        {!calendarLoading && !calendarPermissionGranted && (
          <>
            {calendarCanAskAgain ? (
              <>
                <Pressable
                  onPress={onRequestCalendarPermission}
                  style={({ pressed }) => [styles.row, pressed && styles.btnPressed]}
                >
                  <Text style={styles.rowLabel}>Παραχώρηση πρόσβασης</Text>
                </Pressable>
                <Text style={styles.rowHint}>
                  Χρειάζεται για να επιλέξετε πού αποθηκεύονται οι υπενθυμίσεις.
                </Text>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  style={({ pressed }) => [styles.row, pressed && styles.btnPressed]}
                >
                  <Text style={styles.rowLabel}>Άνοιγμα Ρυθμίσεων</Text>
                </Pressable>
                <Text style={styles.rowHint}>
                  Η επιλογή ημερολογίου απαιτεί πλήρη πρόσβαση. Αν είχατε επιλέξει
                  «Προσθήκη συμβάντων μόνο», μετράει ως περιορισμένη πρόσβαση.
                </Text>
              </>
            )}
          </>
        )}

        {!calendarLoading && calendarPermissionGranted && (
          <>
            {calendarRePickNeeded && (
              <Text style={[styles.rowHint, styles.rowHintWarning]}>
                Το προηγούμενο ημερολόγιο δεν είναι πια διαθέσιμο. Επιλέξτε ένα νέο.
              </Text>
            )}
            {calendars.map((cal) => (
              <Pressable
                key={cal.id}
                onPress={() => onSelectCalendar(cal.id)}
                style={({ pressed }) => [styles.row, pressed && styles.btnPressed]}
              >
                <View style={styles.calendarRowMain}>
                  <View style={[styles.colorDot, { backgroundColor: cal.color }]} />
                  <View>
                    <Text style={styles.rowLabel}>{cal.title}</Text>
                    <Text style={styles.calendarAccount}>{cal.accountName}</Text>
                  </View>
                </View>
                {cal.id === selectedCalendarId && (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                )}
              </Pressable>
            ))}
          </>
        )}

        {Platform.OS === 'ios' && (
          <Pressable onPress={() => Linking.openURL('app-settings:')}>
            <Text style={styles.rowHint}>
              Δεν βλέπετε το Google Calendar; Προσθέστε τον λογαριασμό Google στις
              Ρυθμίσεις iOS → Εφαρμογές → Ημερολόγιο → Λογαριασμοί.
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ειδοποιήσεις</Text>

        {!notificationLoading && !notificationPermissionGranted && (
          <>
            {notificationCanAskAgain ? (
              <>
                <Pressable
                  onPress={onRequestNotificationPermission}
                  style={({ pressed }) => [styles.row, pressed && styles.btnPressed]}
                >
                  <Text style={styles.rowLabel}>Παραχώρηση πρόσβασης</Text>
                </Pressable>
                <Text style={styles.rowHint}>
                  Χρειάζεται για να λαμβάνετε υπενθυμίσεις για τις προθεσμίες σας.
                </Text>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  style={({ pressed }) => [styles.row, pressed && styles.btnPressed]}
                >
                  <Text style={styles.rowLabel}>Άνοιγμα Ρυθμίσεων</Text>
                </Pressable>
                <Text style={styles.rowHint}>
                  Χρειάζεται πρόσβαση ειδοποιήσεων από τις Ρυθμίσεις της συσκευής.
                </Text>
              </>
            )}
          </>
        )}

        {!notificationLoading && notificationPermissionGranted && (
          <Text style={styles.rowHint}>Οι ειδοποιήσεις είναι ενεργές.</Text>
        )}
      </View>

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
  rowHintWarning: {
    color: colors.error,
  },
  sectionLabel: {
    ...type.label,
    paddingTop: spacing.base,
  },
  calendarRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
  },
  calendarAccount: {
    ...type.meta,
    color: colors.textMuted,
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
