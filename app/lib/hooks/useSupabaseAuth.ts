import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '~/lib/persistence/supabaseClient';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

export const useSupabaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setAuthState({ user: null, isLoading: false, error });
        return;
      }

      setAuthState({ user: session?.user ?? null, isLoading: false, error: null });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({ user: session?.user ?? null, isLoading: false, error: null });
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    error: authState.error,
    isAuthenticated: !!authState.user,
    userId: authState.user?.id,
    userEmail: authState.user?.email,
    userMetadata: authState.user?.user_metadata,
  };
};
