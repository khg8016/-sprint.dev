// 주의: .client.ts 파일로 설정해서, SSR 번들에서 제외되도록 유도
import { toast } from 'react-toastify';
import JSZip from 'jszip'; // 여기에 JSZip을 import
import { createChatFromFolder } from '~/utils/folderImport';
import { isBinaryFile, shouldIncludeFile, MAX_FILES } from '~/utils/fileUtils';
import { supabase } from '~/lib/persistence';
import { createChatFromMessages } from '~/lib/persistence/supabase_db';

/**
 * Supabase에서 ZIP을 다운로드 받고, JSZip으로 해제한 뒤,
 * createChatFromFolder → importChat 순으로 진행.
 */
export async function importFromSupabaseClient(uploaderUserId: string, sourceId: string, userId: string) {
  const filePath = `${uploaderUserId}/source-${sourceId}.zip`;
  console.log(filePath);

  const { data, error } = await supabase.storage.from('source-code').download(filePath);
  console.log(data);

  if (error || !data) {
    throw new Error(error?.message || 'No file data from Supabase');
  }

  toast.loading('Importing folder...');

  try {
    const arrayBuffer = await data.arrayBuffer();
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(arrayBuffer);

    const allEntries = Object.entries(zip.files);

    if (allEntries.length === 0) {
      throw new Error('No files found inside the zip');
    }

    if (allEntries.length > MAX_FILES) {
      throw new Error(`Too many files in zip: ${allEntries.length} (max: ${MAX_FILES})`);
    }

    let folderName = 'Unknown Folder';
    const textFiles: File[] = [];
    const binaryFilePaths: string[] = [];

    for (const [relativePath, zipEntry] of allEntries) {
      if (zipEntry.dir) {
        continue;
      }

      const pathParts = relativePath.split('/');

      if (folderName === 'Unknown Folder' && pathParts.length > 1 && pathParts[0]) {
        folderName = pathParts[0];
      }

      if (!shouldIncludeFile(relativePath)) {
        continue;
      }

      const fileData = await zipEntry.async('uint8array');
      const file = new File([fileData], relativePath, { type: 'text/plain' });

      // webkitRelativePath 속성 재정의
      Object.defineProperty(file, 'webkitRelativePath', {
        value: relativePath,
        writable: false,
        configurable: true,
      });

      console.log(file);

      const isBin = await isBinaryFile(file);

      if (isBin) {
        binaryFilePaths.push(relativePath);
      } else {
        textFiles.push(file);
      }
    }

    if (textFiles.length === 0) {
      throw new Error('No text files found in the zip');
    }

    // createChatFromFolder
    const messages = await createChatFromFolder(textFiles, binaryFilePaths, folderName);

    // importChat
    const newId = await createChatFromMessages(userId, folderName, messages);

    window.location.href = `/chat/${newId}`;

    toast.dismiss();
    toast.success('Folder imported successfully');
  } catch (err) {
    toast.dismiss();
    toast.error(`Failed to import folder: ${String(err)}`);
    throw err;
  }
}
