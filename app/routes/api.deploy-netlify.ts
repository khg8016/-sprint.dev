import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { supabase } from '~/lib/persistence';
import { createScopedLogger } from '~/utils/logger';
import axios from 'axios';
import JSZip from 'jszip';

interface NetlifyDeploymentResponse {
  id: string;
  site_id: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
}

interface NetlifySiteResponse {
  id: string;
  name: string;
  custom_domain: string;
  url: string;
  default_domain: string; // netlify.app 도메인
}

interface NetlifyEnv {
  NETLIFY_AUTH_TOKEN: string;
  NETLIFY_TEAM_SLUG?: string;
  NETLIFY_ACCOUNT_SLUG: string;
}

type Env = NetlifyEnv;

declare global {
  interface Env extends NetlifyEnv {}
}

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

interface FileMap {
  [path: string]: {
    type: 'file' | 'folder';
    content?: string;
    isBinary: boolean;
  };
}

interface DeploymentConfig {
  chatId: string;
  files: FileMap;
  subdomain: string;
}

const logger = createScopedLogger('api.deploy-netlify');

async function getDnsZoneId(env: Env, client: typeof axios): Promise<string> {
  try {
    const response = await client.get('https://api.netlify.com/api/v1/dns_zones', {
      params: { account_slug: env.NETLIFY_ACCOUNT_SLUG },
      headers: { Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}` },
    });

    const zone = response.data.find((zone: any) => zone.name === 'sprintsolo.dev');

    if (!zone) {
      throw new Error('DNS zone for sprintsolo.dev not found');
    }

    return zone.id;
  } catch (error: any) {
    throw new Error(`Failed to get DNS zone ID: ${error.message}`);
  }
}

/**
 * 배포할 파일들을 필터링하고 처리하는 함수
 * 1. /dist 디렉토리의 파일들을 우선 사용
 * 2. /dist가 없거나 index.html이 없는 경우 루트 디렉토리의 파일들을 사용
 * 3. index.html이 없는 경우 자동으로 생성
 */
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

async function createNetlifySite(
  config: { siteName: string; customDomain: string },
  env: Env,
  client: typeof axios,
): Promise<{ siteId: string; siteUrl: string }> {
  try {
    const response = await client.post<NetlifySiteResponse>(
      'https://api.netlify.com/api/v1/sites?configure_dns=true',
      {
        name: config.siteName,
        custom_domain: config.customDomain,
        force_ssl: true,
      },
      {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    logger.info(JSON.stringify(response.data));

    return {
      siteId: response.data.id,
      siteUrl: response.data.default_domain,
    };
  } catch (error: any) {
    logger.error('Netlify API Response:', error);
    throw new Error(`Failed to create Netlify site: ${error.message}`);
  }
}

async function setupNetlifyDNSRecord(
  config: { subdomain: string; target: string },
  zoneId: string,
  env: Env,
  client: typeof axios,
) {
  try {
    await client.post(
      `https://api.netlify.com/api/v1/dns_zones/${zoneId}/dns_records`,
      {
        type: 'CNAME',
        hostname: config.subdomain,
        value: config.target,
        ttl: 3600,
      },
      {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    throw new Error(`Failed to manage DNS record: ${error.message}`);
  }
}

async function createZipDeploy(
  config: { siteId: string; files: FileMap },
  env: Env,
  client: typeof axios,
): Promise<NetlifyDeploymentResponse> {
  try {
    logger.info('Creating ZIP deployment...');

    // ZIP 파일 생성
    const zip = new JSZip();

    // 파일 추가
    for (const [path, fileData] of Object.entries(config.files)) {
      if (!fileData || !fileData.content) {
        continue;
      }

      const normalizedPath = path.replace(/^\/+/, '');

      if (fileData.isBinary) {
        // 바이너리 파일은 base64 디코딩하여 Uint8Array로 변환
        const binaryString = atob(fileData.content);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zip.file(normalizedPath, bytes, { binary: true });
      } else {
        // 텍스트 파일은 그대로 추가
        zip.file(normalizedPath, fileData.content);
      }
    }

    // ZIP 생성 (uint8array 타입 사용)
    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    logger.info('ZIP file created, starting upload...');

    // ZIP 파일 업로드
    const response = await client.post(`https://api.netlify.com/api/v1/sites/${config.siteId}/deploys`, zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    logger.info('Deployment completed successfully');

    return response.data;
  } catch (error: any) {
    logger.error('Deployment failed:', error);

    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data));
      logger.error('Response status:', error.response.status);
    }

    throw new Error(`Failed to deploy to Netlify: ${error.message}`);
  }
}

async function deployToNetlify(config: DeploymentConfig, env: Env, client: typeof axios) {
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

    // 4) Netlify ZIP 배포 수행
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

    const env = {
      NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN || context.cloudflare?.env?.NETLIFY_AUTH_TOKEN,
      NETLIFY_TEAM_SLUG: process.env.NETLIFY_TEAM_SLUG || context.cloudflare?.env?.NETLIFY_TEAM_SLUG,
      NETLIFY_ACCOUNT_SLUG: process.env.NETLIFY_ACCOUNT_SLUG || context.cloudflare?.env?.NETLIFY_ACCOUNT_SLUG,
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
