import { supabase } from './supabaseClient';
import type { AuthSession } from '@supabase/supabase-js';

// Sign up with email and password
export const signUp = async (email: string, password: string): Promise<AuthSession | null> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Error signing up:', error.message);
    return null;
  }

  return data.session;
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<AuthSession | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Error signing in:', error.message);
    return null;
  }

  return data.session;
};

// Sign out
export const signOut = async (): Promise<{ error: any }> => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error.message);
  }

  return { error };
};
