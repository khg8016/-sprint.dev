import { createHash } from 'node:crypto';
import { type FileMap } from '~/types/artifact';

/**
 * 파일 내용의 SHA1 해시를 생성합니다.
 */
export function generateSHA1Hash(content: string, isBinary: boolean): string {
  const hash = createHash('sha1');

  if (isBinary) {
    // 바이너리 파일의 경우 base64를 디코딩하여 해시 생성
    const binaryContent = Buffer.from(content, 'base64');
    hash.update(binaryContent);
  } else {
    hash.update(content);
  }

  return hash.digest('hex');
}

/**
 * 파일 내용의 SHA256 해시를 생성합니다.
 */
export function generateSHA256Hash(content: string, isBinary: boolean): string {
  const hash = createHash('sha256');

  if (isBinary) {
    const binaryContent = Buffer.from(content, 'base64');
    hash.update(binaryContent);
  } else {
    hash.update(content);
  }

  return hash.digest('hex');
}

/**
 * 함수 파일 이름을 정규화합니다.
 * 예: /netlify/functions/hello-world.ts -> hello-world
 */
export function normalizeFunctionName(path: string): string {
  const match = path.match(/\/netlify\/functions\/([^/]+)\.[^/.]+$/);
  return match ? match[1] : path;
}

/**
 * 파일 경로를 정규화합니다.
 */
export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

/**
 * 주어진 FileMap에서 함수 파일들을 추출합니다.
 */
export function extractFunctions(files: FileMap): FileMap {
  const functionFiles: FileMap = {};

  for (const [path, fileData] of Object.entries(files)) {
    if (path.includes('/netlify/functions/') && fileData.type === 'file' && fileData.content) {
      functionFiles[path] = fileData;
    }
  }

  return functionFiles;
}

/**
 * 주어진 FileMap에서 일반 파일들을 추출합니다.
 */
export function extractFiles(files: FileMap): FileMap {
  const normalFiles: FileMap = {};

  for (const [path, fileData] of Object.entries(files)) {
    if (!path.includes('/netlify/functions/') && fileData.type === 'file' && fileData.content) {
      normalFiles[path] = fileData;
    }
  }

  return normalFiles;
}
