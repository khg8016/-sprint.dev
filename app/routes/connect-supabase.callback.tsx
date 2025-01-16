import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { useEffect } from 'react';

interface SupabaseTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

type LoaderResponse = { success: true; data: SupabaseTokenResponse } | { success: false; error: string };

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // 쿠키에서 sessionId 가져오기
  const sessionId = request.headers.get('cookie')?.match(/oauth_session=([^;]*)/)?.[1];

  if (!code || !sessionId) {
    return json({ success: false, error: 'Missing parameters' });
  }

  // 1. sessionId를 사용하여 Supabase DB에서 codeVerifier 조회
  const { data: session } = await supabase
    .from('oauth_sessions')
    .select('code_verifier')
    .eq('session_id', sessionId)
    .single();

  if (!session) {
    return json<LoaderResponse>({ success: false, error: 'Session expired or invalid' });
  }

  // 2. codeVerifier 사용하여 Supabase 토큰 교환
  const tokenResponse = await fetch('https://api.supabase.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${process.env.SUPA_CLIENT_ID}:${process.env.SUPA_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: session.code_verifier,
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return json<LoaderResponse>({ success: false, error: 'OAuth token exchange failed' });
  }

  return json<LoaderResponse>({ success: true, data: tokens });
}

export default function SupabaseCallback() {
  const loaderData = useLoaderData<typeof loader>();

  useEffect(() => {
    console.log(loaderData);

    if (loaderData.success && loaderData.data) {
      window.opener?.postMessage({ type: 'SUPABASE_OAUTH_CALLBACK', data: loaderData.data }, window.location.origin);
      window.close();
    }
  }, [loaderData]);

  if (!loaderData.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500">Failed to connect: {loaderData.error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-bolt-elements-textPrimary">Successfully connected to Supabase!</div>
      <div className="text-bolt-elements-textSecondary text-sm">You can close this window now.</div>
    </div>
  );
}
