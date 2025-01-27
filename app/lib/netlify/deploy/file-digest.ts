import { type AxiosInstance } from 'axios';
import { type FileMap } from '~/types/artifact';
import { type FileDigestDeployment, type FileDigestResponse, type NetlifyEnv } from '~/types/netlify';
import { createScopedLogger } from '~/utils/logger';
import JSZip from 'jszip';
import {
  generateSHA1Hash,
  generateSHA256Hash,
  extractFiles,
  extractFunctions,
  normalizePath,
  normalizeFunctionName,
} from './utils';

const logger = createScopedLogger('netlify.deploy.file-digest');

/**
 * File Digest 방식으로 Netlify에 배포를 시작합니다.
 */
export async function createFileDigestDeploy(
  config: { siteId: string; files: FileMap },
  env: NetlifyEnv,
  client: AxiosInstance,
): Promise<FileDigestResponse> {
  try {
    logger.info('Creating file digest deployment...');

    // 1. 파일과 함수를 분리
    const normalFiles = extractFiles(config.files);
    const functionFiles = extractFunctions(config.files);

    // 2. 파일 다이제스트 생성
    const fileDigests: { [path: string]: string } = {};
    const functionDigests: { [name: string]: string } = {};

    // 일반 파일 다이제스트 생성 (SHA1)
    for (const [path, fileData] of Object.entries(normalFiles)) {
      if (!fileData.content) {
        continue;
      }

      const normalizedPath = normalizePath(path);
      fileDigests[normalizedPath] = generateSHA1Hash(fileData.content, fileData.isBinary);
    }

    // 함수 파일 다이제스트 생성 (SHA256)
    for (const [path, fileData] of Object.entries(functionFiles)) {
      if (!fileData.content) {
        continue;
      }

      const functionName = normalizeFunctionName(path);
      functionDigests[functionName] = generateSHA256Hash(fileData.content, fileData.isBinary);
    }

    // 3. 배포 생성 요청
    const deployment: FileDigestDeployment = {
      files: fileDigests,
      functions: functionDigests,
    };

    const response = await client.post<FileDigestResponse>(
      `https://api.netlify.com/api/v1/sites/${config.siteId}/deploys`,
      deployment,
      {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    logger.info('File digest deployment created');

    return response.data;
  } catch (error: any) {
    const errorContext = error.config?.url
      ? `API: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url}`
      : 'Unknown API';
    const errorStatus = error.response?.status ? `, Status: ${error.response.status}` : '';
    const errorMessage = `Failed to create file digest deployment (${errorContext}${errorStatus}): ${error.message}`;

    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', error.response.data);
    }

    throw new Error(errorMessage);
  }
}

/**
 * 필요한 파일들을 Netlify에 업로드합니다.
 */
export async function uploadRequiredFiles(
  deployId: string,
  required: string[],
  files: FileMap,
  env: NetlifyEnv,
  client: AxiosInstance,
): Promise<void> {
  try {
    logger.info('Uploading required files...');

    const hashToFile = new Map<string, { path: string; data: FileMap[string] }>();

    for (const [path, fileData] of Object.entries(files)) {
      if (!fileData.content) {
        continue;
      }

      const hash = generateSHA1Hash(fileData.content, fileData.isBinary);
      hashToFile.set(hash, { path, data: fileData });
    }

    // 필요한 파일들 업로드
    for (const hash of required) {
      const file = hashToFile.get(hash);

      if (!file) {
        logger.warn(`File with hash ${hash} not found`);
        continue;
      }

      const normalizedPath = normalizePath(file.path);
      const content = file.data.isBinary ? Buffer.from(file.data.content!, 'base64') : file.data.content;

      await client.put(`https://api.netlify.com/api/v1/deploys/${deployId}/files/${normalizedPath}`, content, {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info(`Uploaded file: ${normalizedPath}`);
    }
  } catch (error: any) {
    const errorMessage = `Failed to upload files: ${error.message}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * 필요한 함수들을 Netlify에 업로드합니다.
 */
export async function uploadRequiredFunctions(
  deployId: string,
  required: string[],
  files: FileMap,
  env: NetlifyEnv,
  client: AxiosInstance,
): Promise<void> {
  try {
    logger.info('Uploading required functions...');

    const functionFiles = extractFunctions(files);
    const hashToFunction = new Map<string, { name: string; data: FileMap[string] }>();

    // 함수 파일들의 해시 생성
    for (const [path, fileData] of Object.entries(functionFiles)) {
      if (!fileData.content) {
        continue;
      }

      const hash = generateSHA256Hash(fileData.content, fileData.isBinary);
      const functionName = normalizeFunctionName(path);
      hashToFunction.set(hash, { name: functionName, data: fileData });
    }

    // 필요한 함수들 업로드
    for (const hash of required) {
      const func = hashToFunction.get(hash);

      if (!func) {
        logger.warn(`Function with hash ${hash} not found`);
        continue;
      }

      // ZIP 파일 생성
      const zip = new JSZip();
      const content = func.data.content;

      if (!content) {
        logger.warn(`Function content is empty: ${func.name}`);
        continue;
      }

      // 함수 파일 추가 (함수 이름으로 저장)
      const fileContent = func.data.isBinary ? Buffer.from(content, 'base64') : content;
      zip.file(`${func.name}.js`, fileContent);

      // ZIP 생성
      const zipBuffer = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      await client.put(`https://api.netlify.com/api/v1/deploys/${deployId}/functions/${func.name}`, zipBuffer, {
        params: {
          runtime: 'js',
        },
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/zip',
        },
      });

      logger.info(`Uploaded function: ${func.name}`);
    }
  } catch (error: any) {
    const errorMessage = `Failed to upload functions: ${error.message}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}
