import React, { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { signIn, signUp } from '~/lib/persistence/auth';
import type { AuthSession } from '@supabase/supabase-js';
import styles from '~/components/auth/AuthPage.module.scss';

export const AuthButtons: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let session: AuthSession | null = null;

      if (isSignUp) {
        session = await signUp(email, password);
      } else {
        session = await signIn(email, password);
      }

      if (session) {
        navigate('/');
      } else {
        setError('Authentication failed. Please check your credentials and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={`${styles.inputGroup} ${error ? styles.error : ''}`}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email address"
          aria-invalid={error ? 'true' : 'false'}
          autoComplete="email"
          disabled={isLoading}
        />
      </div>

      <div className={`${styles.inputGroup} ${error ? styles.error : ''}`}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="Password"
          aria-invalid={error ? 'true' : 'false'}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          disabled={isLoading}
          minLength={6}
        />
      </div>

      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className={styles.submitButton} disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError(null);
        }}
        className={styles.toggleButton}
        disabled={isLoading}
      >
        {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
      </button>
    </form>
  );
};
