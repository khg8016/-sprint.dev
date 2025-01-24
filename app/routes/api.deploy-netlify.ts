import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { supabase } from '~/lib/persistence';
import { createScopedLogger } from '~/utils/logger';
import axios from 'axios';
import { type FileMap } from '~/types/artifact';
import { type NetlifyEnv } from '~/types/netlify';
import { getDnsZoneId, setupNetlifyDNSRecord } from '~/lib/netlify/dns';
import { createNetlifySite, createZipDeploy } from '~/lib/netlify/site';
import { setupNetlifyEnvVars } from '~/lib/netlify/env';

interface RequestBody {
  chatId: string;
  urlId: string;
  files: FileMap;
}

interface Deployment {
  id: string;
  chat_id: string;
  subdomain: string;
  status: string;
  netlify_deployment_id?: string;
  netlify_site_id?: string;
  created_at: string;
}

interface DeploymentConfig {
  chatId: string;
  files: FileMap;
  subdomain: string;
}

const logger = createScopedLogger('api.deploy-netlify');

function filterDistFiles(files: FileMap): FileMap {
  const distFiles: FileMap = {};
  let hasIndexHtml = false;

  // 먼저 /dist 디렉토리의 파일들을 확인
  for (const [path, fileData] of Object.entries(files)) {
    if (path === '/dist' || path.startsWith('/dist/')) {
      // 앞의 /dist와 시작 슬래시 제거
      const newPath = path.replace(/^\/dist\/?/, '');

      if (!fileData.content) {
        continue;
      }

      if (newPath === 'index.html') {
        hasIndexHtml = true;
      }

      distFiles[newPath] = fileData;
    }
  }

  // /dist 디렉토리에 파일이 없거나 index.html이 없는 경우 루트 디렉토리의 파일들을 사용
  if (Object.keys(distFiles).length === 0 || !hasIndexHtml) {
    for (const [path, fileData] of Object.entries(files)) {
      if (fileData?.type === 'file' && fileData.content) {
        // /home/project/와 시작 슬래시 제거
        const normalizedPath = path.replace(/^\/home\/project\/?/, '');

        if (normalizedPath === 'index.html') {
          hasIndexHtml = true;
        }

        distFiles[normalizedPath] = fileData;
      }
    }
  }

  // index.html이 없는 경우 자동으로 생성
  if (!hasIndexHtml && Object.keys(distFiles).length > 0) {
    const htmlFiles = Object.entries(distFiles).filter(([path]) => path.endsWith('.html'));

    if (htmlFiles.length > 0) {
      const [firstHtmlPath, firstHtmlFile] = htmlFiles[0];
      distFiles['index.html'] = firstHtmlFile;
      delete distFiles[firstHtmlPath];
    } else {
      distFiles['index.html'] = {
        type: 'file',
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Static Site</title>
</head>
<body>
  <h1>Welcome to your static site</h1>
  <p>This is an automatically generated index page.</p>
  ${Object.keys(distFiles)
    .map((path) => `<p><a href="/${path}">${path}</a></p>`)
    .join('\n  ')}
</body>
</html>`,
        isBinary: false,
      };
    }
  }

  return distFiles;
}

async function deployToNetlify(config: DeploymentConfig, env: NetlifyEnv, client: typeof axios) {
  let deployment: Deployment | undefined;

  // 1) /dist 하위 파일만 뽑아서, Netlify에 업로드할 최종 파일맵 구성
  const distFiles = filterDistFiles(config.files);
  console.log(distFiles);

  // 2) 필수 파일(예: /index.html)이 존재하는지 체크
  if (!distFiles['index.html']) {
    throw new Error('No /index.html found in the files. Did you run the build?');
  }

  // 사이트 이름 생성 (chatId 기반으로 고정)
  const shortChatId = config.chatId
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 8);
  const siteName = `spsd-${config.subdomain}-${shortChatId}`;

  try {
    // DNS zone ID 조회
    const zoneId = await getDnsZoneId(env, client);

    // 가장 최근 배포 찾기
    const { data: latestDeployment } = (await supabase
      .from('deployments')
      .select()
      .eq('chat_id', config.chatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()) as { data: Deployment | null };

    // 새 deployment 레코드 생성
    const { data: newDeployment, error: insertError } = (await supabase
      .from('deployments')
      .insert({
        chat_id: config.chatId,
        subdomain: config.subdomain,
        status: 'pending',
        netlify_site_id: latestDeployment?.netlify_site_id, // 이전 배포가 있다면 같은 사이트 ID 사용
      })
      .select()
      .single()) as { data: Deployment; error: any };

    if (insertError) {
      throw insertError;
    }

    deployment = newDeployment;

    // 3) Netlify 사이트 생성 또는 기존 사이트 ID 사용
    let siteId = deployment.netlify_site_id;
    let siteUrl: string;

    if (!siteId) {
      const customDomain = `${config.subdomain}.sprintsolo.dev`;
      const { siteId: newSiteId, siteUrl: newSiteUrl } = await createNetlifySite(
        { siteName, customDomain },
        env,
        client,
      );
      siteId = newSiteId;
      siteUrl = newSiteUrl;

      // 새로 생성된 사이트 ID 업데이트
      const { error: updateError } = await supabase
        .from('deployments')
        .update({ netlify_site_id: siteId })
        .eq('id', deployment.id);

      if (updateError) {
        throw updateError;
      }

      console.log('target', siteUrl);

      // DNS 레코드 설정 (최초 배포 시에만)
      await setupNetlifyDNSRecord(
        {
          subdomain: config.subdomain,
          target: siteUrl,
        },
        zoneId,
        env,
        client,
      );
    }

    // 4) 환경 변수 설정
    await setupNetlifyEnvVars({ siteId, files: config.files, env, client });

    // 5) Netlify ZIP 배포 수행
    const netlifyDeployment = await createZipDeploy(
      {
        siteId,
        files: distFiles,
      },
      env,
      client,
    );

    // Update deployment record
    const { error: updateError } = await supabase
      .from('deployments')
      .update({
        status: 'deployed',
        netlify_deployment_id: netlifyDeployment.id,
      })
      .eq('id', deployment.id);

    if (updateError) {
      throw updateError;
    }

    // Log success
    await supabase.from('deployment_logs').insert({
      deployment_id: deployment.id,
      log_type: 'info',
      message: 'Deployment completed successfully',
    });

    return {
      success: true,
      deployment: {
        ...deployment,
        netlify_deployment_id: netlifyDeployment.id,
        netlify_site_id: siteId,
        url: `https://${config.subdomain}.sprintsolo.dev`,
      },
    };
  } catch (error: any) {
    logger.error('Deployment failed:', error);

    // Log error
    if (deployment?.id) {
      await supabase.from('deployment_logs').insert({
        deployment_id: deployment.id,
        log_type: 'error',
        message: error.message,
      });

      // Update deployment status to failed
      await supabase.from('deployments').update({ status: 'failed' }).eq('id', deployment.id);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

export async function action({ context, request }: ActionFunctionArgs) {
  try {
    const { chatId, urlId, files } = (await request.json()) as RequestBody;

    if (!chatId || !urlId || !files) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    // Ensure subdomain is valid (lowercase alphanumeric with hyphens)
    const safeSubdomainPrefix = `${urlId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-') + `-${chatId}`;

    const authToken =
      process.env.NETLIFY_AUTH_TOKEN ||
      (context.cloudflare && 'env' in context.cloudflare && context.cloudflare.env
        ? context.cloudflare.env.NETLIFY_AUTH_TOKEN
        : undefined);
    const accountSlug =
      process.env.NETLIFY_ACCOUNT_SLUG ||
      (context.cloudflare && 'env' in context.cloudflare && context.cloudflare.env
        ? context.cloudflare.env.NETLIFY_ACCOUNT_SLUG
        : undefined);

    if (!authToken || !accountSlug) {
      throw new Error('Missing required Netlify configuration');
    }

    const env: NetlifyEnv = {
      NETLIFY_AUTH_TOKEN: authToken,
      NETLIFY_ACCOUNT_SLUG: accountSlug,
    };

    if (!env.NETLIFY_AUTH_TOKEN || !env.NETLIFY_ACCOUNT_SLUG) {
      throw new Error('Missing required Netlify configuration');
    }

    const result = await deployToNetlify({ chatId, files, subdomain: safeSubdomainPrefix }, env, axios);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      statusText: result.success ? 'OK' : 'Internal Server Error',
    });
  } catch (error: any) {
    logger.error(error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
