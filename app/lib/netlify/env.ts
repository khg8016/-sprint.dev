import { type NetlifyEnv, type NetlifyEnvVar, type NetlifyEnvVarValue } from '~/types/netlify';
import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from '~/types/artifact';
import type { AxiosInstance } from 'axios';

const logger = createScopedLogger('netlify.env');

interface EnvSyncOptions {
  siteId: string;
  files: FileMap;
  env: NetlifyEnv;
  client: AxiosInstance;
}

export async function setupNetlifyEnvVars({ siteId, files, env, client }: EnvSyncOptions) {
  try {
    // 1. 현재 설정된 환경 변수 조회
    const response = await client.get(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
      headers: {
        Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
      },
    });

    // 응답이 배열 형태로 오므로, key를 기준으로 맵으로 변환
    const existingEnvVars = (response.data as NetlifyEnvVar[]).reduce(
      (acc, envVar) => {
        // context가 'all'인 값만 사용
        const value = envVar.values.find((v) => v.context === 'all')?.value;

        if (value) {
          acc[envVar.key] = {
            value,
            scopes: envVar.scopes || [],
            is_secret: envVar.is_secret,
          };
        }

        return acc;
      },
      {} as Record<string, NetlifyEnvVarValue>,
    );

    // 2. .env 파일 찾기 및 파싱
    const envFile = Object.entries(files).find(([path]) => path.endsWith('.env'));

    if (!envFile) {
      return; // .env 파일이 없으면 종료
    }

    const [, fileData] = envFile;

    if (!fileData.content) {
      return;
    }

    // 3. .env 파일 파싱
    const envVars = fileData.content
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .reduce((acc: Record<string, string>, line) => {
        const [key, ...valueParts] = line.split('=');

        if (key) {
          acc[key.trim()] = valueParts
            .join('=')
            .trim()
            .replace(/^["']|["']$/g, '');
        }

        return acc;
      }, {});

    // 4. 환경 변수 동기화 처리
    const toCreate: NetlifyEnvVar[] = [];
    const toUpdate: NetlifyEnvVar[] = [];
    const toDelete: string[] = [];

    // 4.1 생성/업데이트할 변수 분류
    for (const [key, value] of Object.entries(envVars)) {
      const envVarConfig: NetlifyEnvVar = {
        key,
        values: [{ value, context: 'all' }],
        is_secret: existingEnvVars[key]?.is_secret || false,
      };

      if (!existingEnvVars[key]) {
        toCreate.push(envVarConfig);
      } else if (existingEnvVars[key].value !== value) {
        toUpdate.push(envVarConfig);
      }
    }

    // 4.2 삭제할 변수 찾기 (.env에 없는 기존 변수)
    for (const key of Object.keys(existingEnvVars)) {
      if (!envVars[key]) {
        toDelete.push(key);
      }
    }

    // 5. API 요청 처리
    const requests: Promise<any>[] = [];

    // 5.1 새로운 변수 생성
    if (toCreate.length > 0) {
      requests.push(
        client.post(`https://api.netlify.com/api/v1/accounts/${env.NETLIFY_ACCOUNT_SLUG}/env`, toCreate, {
          params: { site_id: siteId },
          headers: {
            Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }),
      );
    }

    // 5.2 기존 변수 업데이트
    for (const envVar of toUpdate) {
      requests.push(
        client.put(`https://api.netlify.com/api/v1/accounts/${env.NETLIFY_ACCOUNT_SLUG}/env/${envVar.key}`, envVar, {
          params: { site_id: siteId },
          headers: {
            Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }),
      );
    }

    // 5.3 삭제 (각 변수별로 처리 필요)
    for (const key of toDelete) {
      requests.push(
        client.delete(`https://api.netlify.com/api/v1/accounts/${env.NETLIFY_ACCOUNT_SLUG}/env/${key}`, {
          params: { site_id: siteId },
          headers: {
            Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          },
        }),
      );
    }

    // 6. 모든 요청 병렬 처리
    await Promise.all(requests);

    logger.info(
      `Environment variables synchronized. Created: ${toCreate.length}, Updated: ${toUpdate.length}, Deleted: ${toDelete.length}`,
    );
  } catch (error: any) {
    const errorContext = error.config?.url
      ? `API: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url}`
      : 'Unknown API';
    const errorStatus = error.response?.status ? `, Status: ${error.response.status}` : '';
    const errorMessage = `Failed to setup environment variables (${errorContext}${errorStatus}): ${error.message}`;

    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', JSON.stringify(error.response.data));
    }

    throw new Error(errorMessage);
  }
}
