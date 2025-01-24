import { type NetlifyEnv, type NetlifySiteResponse, type NetlifyDeploymentResponse } from '~/types/netlify';
import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from '~/types/artifact';
import type { AxiosInstance } from 'axios';
import JSZip from 'jszip';

const logger = createScopedLogger('netlify.site');

export async function createNetlifySite(
  config: { siteName: string; customDomain: string },
  env: NetlifyEnv,
  client: AxiosInstance,
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
    const errorContext = error.config?.url
      ? `API: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url}`
      : 'Unknown API';
    const errorStatus = error.response?.status ? `, Status: ${error.response.status}` : '';
    const errorMessage = `Failed to create Netlify site (${errorContext}${errorStatus}): ${error.message}`;

    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', error.response.data);
    }

    throw new Error(errorMessage);
  }
}

export async function createZipDeploy(
  config: { siteId: string; files: FileMap },
  env: NetlifyEnv,
  client: AxiosInstance,
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
    const errorContext = error.config?.url
      ? `API: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url}`
      : 'Unknown API';
    const errorStatus = error.response?.status ? `, Status: ${error.response.status}` : '';
    const errorMessage = `Failed to deploy to Netlify (${errorContext}${errorStatus}): ${error.message}`;

    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', error.response.data);
    }

    throw new Error(errorMessage);
  }
}
