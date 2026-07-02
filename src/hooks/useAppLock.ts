import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PREF_KEY = 'app_lock_enabled';

export function useAppLock(sessionExists: boolean) {
  const [locked, setLocked] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockEnabled, setLockEnabledState] = useState(true);

  // Track whether we've completed the initial availability check
  const initialized = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function init() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      setLockAvailable(available);

      const stored = await SecureStore.getItemAsync(PREF_KEY);
      // Default: enabled if hardware is available
      const enabled = stored !== null ? stored === 'true' : available;
      setLockEnabledState(enabled);

      // Lock on cold start if session exists and lock is on
      if (sessionExists && available && enabled) {
        setLocked(true);
      }
      initialized.current = true;
    }
    init();
  }, []);

  // Re-lock when app returns from background
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (
        initialized.current &&
        sessionExists &&
        lockAvailable &&
        lockEnabled &&
        prev === 'background' &&
        nextState === 'active'
      ) {
        setLocked(true);
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [sessionExists, lockAvailable, lockEnabled]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ξεκλειδώστε το VoiceNote',
      fallbackLabel: 'Χρησιμοποιήστε κωδικό',
      cancelLabel: 'Άκυρο',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLocked(false);
    }
  }, []);

  const setLockEnabled = useCallback(async (enabled: boolean) => {
    setLockEnabledState(enabled);
    await SecureStore.setItemAsync(PREF_KEY, enabled ? 'true' : 'false');
    if (!enabled) {
      setLocked(false);
    }
  }, []);

  return { locked, lockAvailable, lockEnabled, unlock, setLockEnabled };
}
