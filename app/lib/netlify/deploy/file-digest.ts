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

    logger.info(
      `Found ${Object.keys(normalFiles).length} normal files and ${Object.keys(functionFiles).length} function files`,
    );

    // 2. 파일 다이제스트 생성
    const fileDigests: { [path: string]: string } = {};
    const functionDigests: { [name: string]: string } = {};

    // 일반 파일 다이제스트 생성 (SHA1)
    for (const [path, fileData] of Object.entries(normalFiles)) {
      if (!fileData.content) {
        continue;
      }

      const normalizedPath = normalizePath(path);
      fileDigests[normalizedPath] = await generateSHA1Hash(fileData.content, fileData.isBinary);
    }

    // 함수 파일 다이제스트 생성 (SHA256)
    for (const [path, fileData] of Object.entries(functionFiles)) {
      if (!fileData.content) {
        continue;
      }

      const functionName = normalizeFunctionName(path);
      functionDigests[functionName] = await generateSHA256Hash(fileData.content, fileData.isBinary);
      logger.info(`Generated digest for function: ${functionName}`);
    }

    // 3. 배포 생성 요청
    const deployment: FileDigestDeployment = {
      files: fileDigests,
      functions: functionDigests,
    };

    logger.info('Deployment payload:', JSON.stringify(deployment));

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

    logger.info('File digest deployment created:', JSON.stringify(response.data));

    return response.data;
  } catch (error: any) {
    const errorContext = error.config?.url
      ? `API: ${error.config.method?.toUpperCase() || 'UNKNOWN'} ${error.config.url}`
      : 'Unknown API';
    const errorStatus = error.response?.status ? `, Status: ${error.response.status}` : '';
    const errorMessage = `Failed to create file digest deployment (${errorContext}${errorStatus}): ${error.message}`;

    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', JSON.stringify(error.response.data));
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

      const hash = await generateSHA1Hash(fileData.content, fileData.isBinary);
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

      if (!content) {
        logger.warn(`Skipping empty file: ${normalizedPath}`);
        continue;
      }

      logger.info(`Uploading file: ${normalizedPath} (size: ${content.length} bytes)`);

      await client.put(`https://api.netlify.com/api/v1/deploys/${deployId}/files/${normalizedPath}`, content, {
        headers: {
          Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info(`Successfully uploaded file: ${normalizedPath}`);
    }
  } catch (error: any) {
    const errorMessage = `Failed to upload files: ${error.message}`;
    logger.error(errorMessage);

    if (error.response?.data) {
      logger.error('Response data:', JSON.stringify(error.response.data));
    }

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
    logger.info('Required function hashes:', JSON.stringify(required));

    const functionFiles = extractFunctions(files);
    const hashToFunction = new Map<string, { name: string; data: FileMap[string] }>();

    // 함수 파일들의 해시 생성
    for (const [path, fileData] of Object.entries(functionFiles)) {
      if (!fileData.content) {
        continue;
      }

      const hash = await generateSHA256Hash(fileData.content, fileData.isBinary);
      const functionName = normalizeFunctionName(path);
      hashToFunction.set(hash, { name: functionName, data: fileData });
      logger.info(`Mapped function ${functionName} to hash ${hash}`);
    }

    // 필요한 함수들 업로드
    for (const hash of required) {
      const func = hashToFunction.get(hash);

      if (!func) {
        logger.warn(`Function with hash ${hash} not found`);
        continue;
      }

      logger.info(`Processing function: ${func.name}`);
      logger.info(`Function content type: ${func.data.isBinary ? 'binary' : 'text'}`);
      logger.info(`Function content length: ${func.data.content?.length || 0}`);

      // ZIP 파일 생성
      const zip = new JSZip();
      const content = func.data.content;

      if (!content) {
        logger.warn(`Function content is empty: ${func.name}`);
        continue;
      }

      // 함수 파일을 ZIP 루트에 추가 (content는 이미 null이 아님이 확인됨)
      const fileContent = func.data.isBinary ? Buffer.from(content!, 'base64') : content!;
      logger.info(`Adding function file to ZIP root: ${func.name}.js`);
      zip.file(`${func.name}.js`, fileContent);

      // package.json이 있다면 함께 추가
      const packageJsonPath = 'netlify/functions/package.json';
      const packageJson = files[packageJsonPath];

      if (packageJson?.content) {
        logger.info('Adding package.json to ZIP root');
        zip.file('package.json', packageJson.content);
      }

      // node_modules가 있다면 함께 추가
      for (const [path, fileData] of Object.entries(files)) {
        if (path.startsWith('netlify/functions/node_modules/') && fileData?.content) {
          const relativePath = path.replace('netlify/functions/', '');
          logger.info(`Adding dependency file to ZIP: ${relativePath}`);

          const depContent = fileData.isBinary ? Buffer.from(fileData.content, 'base64') : fileData.content;
          zip.file(relativePath, depContent);
        }
      }

      // ZIP 생성
      logger.info('Generating ZIP file...');

      const zipBuffer = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      logger.info(`ZIP file size: ${zipBuffer.length} bytes`);

      logger.info(`Uploading function to: /api/v1/deploys/${deployId}/functions/${func.name}`);

      const response = await client.put(
        `https://api.netlify.com/api/v1/deploys/${deployId}/functions/${func.name}`,
        zipBuffer,
        {
          params: {
            runtime: 'js',
          },
          headers: {
            Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`,
            'Content-Type': 'application/zip',
          },
        },
      );

      logger.info(`Function upload response status: ${response.status}`);

      if (response.data) {
        logger.info('Function upload response:', JSON.stringify(response.data));
      }

      logger.info(`Successfully uploaded function: ${func.name}`);
    }
  } catch (error: any) {
    logger.error(JSON.stringify(error));

    const errorMessage = `Failed to upload functions: ${error.message}`;
    logger.error(errorMessage);
    error.message = errorMessage; // 원본 에러 객체를 그대로 throw
    throw error;
  }
}
