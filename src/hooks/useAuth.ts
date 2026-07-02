import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../services/authService';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const unsubscribe = onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return unsubscribe;
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
