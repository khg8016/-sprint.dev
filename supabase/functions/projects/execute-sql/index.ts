/* eslint-disable */
// @ts-nocheck
import { Application, Router } from 'https://deno.land/x/oak@v11.1.0/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SPRINT_DEV_URL = Deno.env.get('SPRINT_DEV_URL')!;

// Supabase 클라이언트 설정
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const router = new Router();

// SQL 실행 함수
async function executeSupabaseSQL(chatId: string, sql: string) {
  try {
    // 1. chat_supabase_connections 조회
    const { data: connection, error: connectionError } = await supabase
      .from('chat_supabase_connections')
      .select('*')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .eq('project_status', 'ACTIVE')
      .single();

    if (!connection || connectionError) {
      throw new Error('No active Supabase connection found for chat');
    }

    // 2. 프로젝트의 Supabase 클라이언트 생성
    const projectClient = createClient(
      `https://${connection.project_id}.supabase.co`,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 5. SQL 실행
    const { data, error } = await projectClient.rpc('execute_sql', {
      query: sql,
    });

    if (error) throw error;
    return { data, error: null };

  } catch (error) {
    console.error('SQL execution error:', error);
    return { data: null, error: error.message };
  }
}

// SQL 실행 엔드포인트
router.post('/', async (ctx) => {
  try {
    const { chatId, sql } = await ctx.request.body().value;

    if (!chatId || !sql) {
      ctx.response.status = 400;
      ctx.response.body = { error: 'Missing chat ID or SQL query' };
      return;
    }

    const result = await executeSupabaseSQL(chatId, sql);
    
    if (result.error) {
      ctx.response.status = 500;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.body = { data: result.data };
  } catch (error) {
    console.error('API error:', error);
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

const app = new Application();

// CORS 설정
app.use(
  oakCors({
    origin: SPRINT_DEV_URL,
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  }),
);

// 라우터 등록
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8001 });
