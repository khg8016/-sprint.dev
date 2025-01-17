import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';

// import { supabase } from '~/lib/persistence/supabaseClient';

/*
 * interface SupabaseTokenResponse {
 *   access_token: string;
 *   token_type: string;
 *   expires_in: number;
 *   refresh_token: string;
 * }
 */

// type LoaderResponse = { success: true; data: SupabaseTokenResponse } | { success: false; error: string };

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // Get chat ID from state parameter

  return json({ code: code || '', chatId: state || '' });
}

export default function SupabaseCallback() {
  const { code, chatId } = useLoaderData<typeof loader>();

  const { userId, isLoading } = useSupabaseAuth();
  const navigate = useNavigate();
  const getOauthToken = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Failed to get user: ' + 'User not found');
      }

      const response = await fetch(
        import.meta.env.VITE_SUPABASE_FUNCTION_URL +
          '/connect-supabase/oauth2/callback?code=' +
          code +
          '&user_id=' +
          userId,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch login URL');
      }

      // const tokens = (await response.json()) as SupabaseTokenResponse;

      // Calculate expires_at by adding expires_in seconds to current time

      // const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      /*
       * const { error } = await supabase.from('supabase_tokens').insert([
       *   {
       *     user_id: userId,
       *     access_token: tokens.access_token,
       *     refresh_token: tokens.refresh_token,
       *     expires_in: tokens.expires_in,
       *     token_type: tokens.token_type,
       *     expires_at: expiresAt.toISOString(),
       *   },
       * ]);
       */

      /*
       * if (error) {
       *   throw new Error('Failed to save tokens: ' + error.message);
       * }
       */

      // Navigate back to specific chat page after successful connection
      navigate(chatId ? `/chat/${chatId}` : '/chat');
    } catch (error) {
      console.error('Failed to connect:', error);

      // Show error message to user
      alert('Failed to connect to Supabase. Please try again.');
    }
  }, []);

  useEffect(() => {
    if (!isLoading && userId) {
      getOauthToken(userId);
    }
  }, [isLoading, userId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-bolt-elements-textPrimary">Successfully connected to Supabase!</div>
      <div className="text-bolt-elements-textSecondary text-sm">You can close this window now.</div>
    </div>
  );
}
