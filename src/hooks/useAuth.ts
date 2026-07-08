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

  useEffect(() => {
    // Guards against getSession() both rejecting AND hanging forever (seen in
    // production TestFlight builds) — either way we must fall through to the
    // login screen instead of leaving the app stuck on the loading view.
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(
        `[useAuth] getSession() timed out after ${SESSION_LOAD_TIMEOUT_MS}ms (likely network) — falling through to login`,
      );
      setSession(null);
      setLoading(false);
    }, SESSION_LOAD_TIMEOUT_MS);

    getSession()
      .then(({ data }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setSession(data.session);
        setLoading(false);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error('[useAuth] getSession() rejected (likely SecureStore/unhandled) — falling through to login:', error);
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
    user: session?.user ?? null,
    signUp,
    signIn,
    signOut,
  };
}
