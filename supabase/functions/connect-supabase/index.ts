/* eslint-disable */
// @ts-nocheck
import { Application, Router } from 'https://deno.land/x/oak@v11.1.0/mod.ts';
import { CookieStore, Session } from 'https://deno.land/x/oak_sessions@v4.1.9/mod.ts';
import { OAuth2Client } from 'https://deno.land/x/oauth2_client@v1.0.2/mod.ts';
import { SupabaseManagementAPI } from 'https://esm.sh/supabase-management-js@0.1.2';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SPRINT_DEV_URL = 'https://99ff-121-134-241-230.ngrok-free.app';

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
  // Construct the URL for the authorization redirect and get a PKCE codeVerifier.
  const { uri, codeVerifier } = await oauth2Client.code.getAuthorizationUri();
  console.log(uri.toString());

  // Store both the state and codeVerifier in the user session.

  // ctx.state.session.flash('codeVerifier', codeVerifier);

  // Redirect the user to the authorization endpoint.

  // ctx.response.redirect(uri);

  // 1. sessionId 생성 (UUID 사용)
  const sessionId = crypto.randomUUID();

  // 2. Supabase DB에 `sessionId`와 `codeVerifier` 저장
  const { error } = await supabase
    .from('oauth_sessions')
    .insert({ session_id: sessionId, code_verifier: codeVerifier, created_at: new Date().toISOString() });

  if (error) {
    console.error('Failed to store session:', error);
    ctx.response.status = 500;
    ctx.response.body = { error: 'Internal Server Error' };

    return;
  }

  // 3. sessionId를 쿠키로 설정 (Secure, HttpOnly)
  ctx.response.headers.set('Set-Cookie', `oauth_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None`);

  ctx.response.body = { redirectUrl: uri.toString() };
});
router.get('/connect-supabase/oauth2/callback', async (ctx) => {
  /*
   * Make sure the codeVerifier is present for the user's session.
   * const codeVerifier = ctx.state.session.get('codeVerifier') as string;
   * console.log('codeVerifier', codeVerifier);
   */

  /*
   * if (!codeVerifier) {
   *   throw new Error('No codeVerifier!');
   * }
   */

  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');

  // 1. 쿠키에서 sessionId 가져오기
  const cookies = ctx.request.headers.get('cookie');
  const sessionId = cookies?.match(/oauth_session=([^;]*)/)?.[1];

  if (!code || !sessionId) {
    ctx.response.status = 400;
    ctx.response.body = { error: 'Missing authorization code or session' };

    return;
  }

  // 2. Supabase DB에서 sessionId로 codeVerifier 조회
  const { data: session, error } = await supabase
    .from('oauth_sessions')
    .select('code_verifier')
    .eq('session_id', sessionId)
    .single();

  if (!session || error) {
    ctx.response.status = 400;
    ctx.response.body = { error: 'Invalid or expired session' };

    return;
  }

  // Exchange the authorization code for an access token.
  const tokens = await fetch(config.tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: ctx.request.url.searchParams.get('code') || '',
      redirect_uri: config.redirectUri,
      code_verifier: session.code_verifier,
    }),
  }).then((res) => res.json());
  console.log('tokens', tokens);

  /*
   * Use the access token to make an authenticated API request.
   * const supaManagementClient = new SupabaseManagementAPI({
   *   accessToken: tokens.accessToken ?? tokens.access_token,
   * });
   * const projects = await supaManagementClient.getProjects();
   */

  ctx.response.body = tokens;
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
