/* eslint-disable */
// @ts-nocheck
import { Application, Router } from 'https://deno.land/x/oak@v11.1.0/mod.ts';
import { CookieStore, Session } from 'https://deno.land/x/oak_sessions@v4.1.9/mod.ts';
import { OAuth2Client } from 'https://deno.land/x/oauth2_client@v1.0.2/mod.ts';
import { SupabaseManagementAPI } from 'https://esm.sh/supabase-management-js@0.1.2';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SPRINT_DEV_URL = Deno.env.get('SPRINT_DEV_URL')!;

const config = {
  clientId: Deno.env.get('SUPA_CONNECT_CLIENT_ID')!,
  clientSecret: Deno.env.get('SUPA_CONNECT_CLIENT_SECRET')!,
  authorizationEndpointUri: 'https://api.supabase.com/v1/oauth/authorize',
  tokenUri: 'https://api.supabase.com/v1/oauth/token',
  redirectUri: SPRINT_DEV_URL + '/connect-supabase/callback',
};
const oauth2Client = new OAuth2Client(config);

// Supabase 클라이언트 설정 (Edge Function에서 Supabase DB 사용)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type AppState = {
  session: Session;
};

const router = new Router<AppState>();

router.get('/connect-supabase', (ctx) => {
  ctx.response.body =
    'This is an example of implementing https://supabase.com/docs/guides/integrations/oauth-apps/authorize-an-oauth-app . Navigate to /login to start the OAuth flow.';
});

router.get('/connect-supabase/login', async (ctx) => {
  const url = new URL(ctx.request.url);
  // Construct the URL for the authorization redirect and get a PKCE codeVerifier
  const { uri: baseUri, codeVerifier } = await oauth2Client.code.getAuthorizationUri();

  // Add user_id to the redirect URI
  const uri = new URL(baseUri);

  // Generate session ID
  const sessionId = crypto.randomUUID();

  // Store session and code verifier
  const { error } = await supabase.from('oauth_sessions').insert({
    session_id: sessionId,
    code_verifier: codeVerifier,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to store session:', error);
    ctx.response.status = 500;
    ctx.response.body = { error: 'Internal Server Error' };
    return;
  }

  // Set session cookie
  ctx.response.headers.set('Set-Cookie', `oauth_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None`);

  ctx.response.body = { redirectUrl: uri.toString() };
});
router.get('/connect-supabase/oauth2/callback', async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');
  // const userId = url.searchParams.get('user_id');

  // 1. 쿠키에서 sessionId 가져오기
  const cookies = ctx.request.headers.get('cookie');
  const sessionId = cookies?.match(/oauth_session=([^;]*)/)?.[1];

  if (!code || !sessionId) {
    ctx.response.status = 400;
    ctx.response.body = { error: 'Missing authorization code, session, or user ID' };
    return;
  }

  // 2. Supabase DB에서 sessionId로 codeVerifier 조회
  const { data: session, error: sessionError } = await supabase
    .from('oauth_sessions')
    .select('code_verifier')
    .eq('session_id', sessionId)
    .single();

  if (!session || sessionError) {
    ctx.response.status = 400;
    ctx.response.body = { error: 'Invalid or expired session' };
    return;
  }

  try {
    // Exchange the authorization code for an access token
    const tokens = await fetch(config.tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
        code_verifier: session.code_verifier,
      }),
    }).then((res) => res.json());

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Calculate expires_at timestamp
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens in database
    const { error: insertError } = await supabase.from('supabase_tokens').insert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to store tokens: ${insertError.message}`);
    }

    ctx.response.body = { success: true };
  } catch (error) {
    console.error('Token exchange error:', error);
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

router.post('/connect-supabase/refresh', async (ctx) => {
  try {
    const userId = await ctx.request.body().value.then((body) => body.user_id);

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { error: 'Missing user ID' };
      return;
    }

    // Get current tokens
    const { data: currentTokens, error: fetchError } = await supabase
      .from('supabase_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!currentTokens || fetchError) {
      ctx.response.status = 404;
      ctx.response.body = { error: 'No tokens found for user' };
      return;
    }

    // Exchange refresh token for new access token
    const response = await fetch(config.tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refresh_token,
      }),
    }).then((res) => res.json());

    if (response.error) {
      throw new Error(response.error_description || response.error);
    }
    console.log(response)
    // Calculate new expires_at
    const expiresAt = new Date();
    // Ensure expires_in is a valid number
    const expiresIn = parseInt(response.expires_in, 10);
    if (isNaN(expiresIn)) {
      throw new Error('Invalid expires_in value received from token endpoint');
    }
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // Update tokens in database
    const { error: updateError } = await supabase
      .from('supabase_tokens')
      .update({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        token_type: response.token_type,
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`);
    }

    ctx.response.body = { success: true };
  } catch (error) {
    console.error('Token refresh error:', error);
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

const app = new Application<AppState>();

// CORS 설정
app.use(
  oakCors({
    origin: SPRINT_DEV_URL,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    exposeHeaders: ['Location'], // 🚀 클라이언트에서 `Location` 헤더를 읽을 수 있도록 설정
  }),
);

// 세션 초기화
const store = new CookieStore('very-secret-key');
app.use(Session.initMiddleware(store));

// 라우터 등록
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
