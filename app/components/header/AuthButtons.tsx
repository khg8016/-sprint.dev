import React, { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { signIn, signUp } from '~/lib/persistence/auth';
import type { AuthSession } from '@supabase/supabase-js';

export const AuthButtons: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let session: AuthSession | null = null;

    if (isSignUp) {
      session = await signUp(email, password);
    } else {
      session = await signIn(email, password);
    }

    if (session) {
      // Successful authentication, redirect to main page
      navigate('/');
    } else {
      // Handle authentication error
      setError('Authentication failed. Please check your credentials and try again.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded"
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      <button onClick={() => setIsSignUp(!isSignUp)} className="mt-2 text-sm text-blue-500 hover:underline">
        {isSignUp ? 'Already have an account?' : 'Create an account'}
      </button>
    </div>
  );
};
