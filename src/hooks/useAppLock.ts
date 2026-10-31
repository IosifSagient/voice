import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PREF_KEY = 'app_lock_enabled';
const LOCK_READ_TIMEOUT_MS = 3000;

type LockRead = { available: boolean; enabled: boolean } | 'failed';

// Cold-launch lock decision. A failed read fails safe: with a session present,
// lock rather than let a Keychain glitch bypass the setting.
export function shouldLockOnColdStart(sessionExists: boolean, read: LockRead): boolean {
  if (!sessionExists) return false;
  if (read === 'failed') return true;
  return read.available && read.enabled;
}

export function useAppLock(sessionExists: boolean, authLoading: boolean) {
  const [locked, setLocked] = useState(false);
  const [lockDecided, setLockDecided] = useState(false);
  const [lockRead, setLockRead] = useState<LockRead | null>(null);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockEnabled, setLockEnabledState] = useState(true);

  // Track whether we've completed the initial availability check
  const initialized = useRef(false);
  const decided = useRef(false);
  // The AppState listener needs the lock state before React commits it: the
  // background lock can still be uncommitted when the app returns.
  const lockedRef = useRef(false);
  const wentToBackground = useRef(false);
  const promptInFlight = useRef(false);

  useEffect(() => {
    async function readSettings(): Promise<LockRead> {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      setLockAvailable(available);

      const stored = await SecureStore.getItemAsync(PREF_KEY);
      // Default: enabled if hardware is available
      const enabled = stored !== null ? stored === 'true' : available;
      setLockEnabledState(enabled);
      return { available, enabled };
    }

    // App.tsx holds its spinner until the decision below, so a hung read must
    // not be able to hold it forever.
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<LockRead>((resolve) => {
      timeoutId = setTimeout(() => {
        console.error(`[useAppLock:init] settings read exceeded ${LOCK_READ_TIMEOUT_MS}ms`);
        resolve('failed');
      }, LOCK_READ_TIMEOUT_MS);
    });

    Promise.race([readSettings(), timeout])
      .catch((err): LockRead => {
        console.error('[useAppLock:init] failed to read lock settings', err);
        return 'failed';
      })
      .then((read) => {
        clearTimeout(timeoutId);
        initialized.current = true;
        setLockRead(read);
      });

    return () => clearTimeout(timeoutId);
  }, []);

  // Runs once, when both auth and the settings read have settled. Never re-runs:
  // a session that appears later is a fresh sign-in, which must not lock.
  useEffect(() => {
    if (decided.current || authLoading || lockRead === null) return;
    decided.current = true;
    if (shouldLockOnColdStart(sessionExists, lockRead)) {
      lockedRef.current = true;
      setLocked(true);
    }
    setLockDecided(true);
  }, [authLoading, lockRead, sessionExists]);

  const unlock = useCallback(async () => {
    if (promptInFlight.current) return;
    promptInFlight.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ξεκλειδώστε το VoiceNote',
        fallbackLabel: 'Χρησιμοποιήστε κωδικό',
        cancelLabel: 'Άκυρο',
        disableDeviceFallback: false,
      });
      if (result.success) {
        lockedRef.current = false;
        setLocked(false);
      }
    } catch (err) {
      console.error('[useAppLock:unlock] authentication failed', err);
    } finally {
      promptInFlight.current = false;
    }
  }, []);

  // Auto-prompt for a lock engaged in the foreground (cold launch). A lock
  // engaged in the background waits for the return to active below — a prompt
  // fired while backgrounded just fails.
  useEffect(() => {
    if (locked && sessionExists && AppState.currentState === 'active') {
      unlock();
    }
  }, [locked, sessionExists, unlock]);

  // Re-lock on the way INTO background, not on return: a URL opening the app
  // can reach JS before 'active', and would otherwise be handled by a container
  // that unmounts a moment later. 'inactive' (Face ID prompt, Control Center,
  // Notification Center) must not lock.
  //
  // Auto-prompt only on the first 'active' after a real background: the Face ID
  // sheet itself goes active → inactive → active, so prompting on that would
  // loop after a cancel. Until the next background, the button is the retry.
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'background') {
        wentToBackground.current = true;
        if (initialized.current && sessionExists && lockAvailable && lockEnabled) {
          lockedRef.current = true;
          setLocked(true);
        }
      } else if (nextState === 'active' && wentToBackground.current) {
        wentToBackground.current = false;
        if (lockedRef.current && sessionExists) {
          unlock();
        }
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [sessionExists, lockAvailable, lockEnabled, unlock]);

  const setLockEnabled = useCallback(async (enabled: boolean) => {
    setLockEnabledState(enabled);
    await SecureStore.setItemAsync(PREF_KEY, enabled ? 'true' : 'false');
    if (!enabled) {
      lockedRef.current = false;
      setLocked(false);
    }
  }, []);

  return { locked, lockDecided, lockAvailable, lockEnabled, unlock, setLockEnabled };
}
