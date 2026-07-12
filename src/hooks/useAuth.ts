import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../services/authService';

const SESSION_LOAD_TIMEOUT_MS = 9000;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // TEMP DIAGNOSTIC — remove after TestFlight root-cause is confirmed.
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Guards against getSession() both rejecting AND hanging forever (seen in
    // production TestFlight builds) — either way we must fall through to the
    // login screen instead of leaving the app stuck on the loading view.
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      const message = `timeout: getSession() did not resolve within ${SESSION_LOAD_TIMEOUT_MS}ms (likely network)`;
      console.error(`[useAuth] ${message} — falling through to login`);
      setAuthError(message);
      setSession(null);
      setLoading(false);
    }, SESSION_LOAD_TIMEOUT_MS);

    getSession()
      .then(({ data }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAuthError(null);
        setSession(data.session);
        setLoading(false);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const message = `rejected: ${error?.message ?? String(error)}`;
        console.error(`[useAuth] getSession() ${message} (likely SecureStore/unhandled) — falling through to login`, error);
        setAuthError(message);
        setSession(null);
        setLoading(false);
      });

    const unsubscribe = onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    // TEMP DIAGNOSTIC — remove after TestFlight root-cause is confirmed.
    authError,
    user: session?.user ?? null,
    signUp,
    signIn,
    signOut,
  };
}
