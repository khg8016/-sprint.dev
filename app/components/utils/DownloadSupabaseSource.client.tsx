import { useEffect, useState } from 'react';
import React from 'react';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { importFromSupabaseClient } from '~/lib/utils/importFromSupabase';
import styles from './DownloadSupabaseSource.module.scss';
interface Props {
  uploaderUserId: string;
  sourceId: string;
}

export default function DownloadSupabaseSource({ uploaderUserId, sourceId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { userId } = useSupabaseAuth();

  // 브라우저(client)에서만 실행되어야 할 로직
  useEffect(() => {
    if (!userId || !sourceId) {
      return;
    }

    // 클라이언트 환경에서만 동적 import
    setIsLoading(true);
    importFromSupabaseClient(uploaderUserId, sourceId, userId);
  }, [userId, sourceId]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{isLoading ? 'Importing Chat...' : ''}</h1>

      {isLoading && (
        <>
          <div className={styles.spinner} />
          <p className={styles.message}>Processing your files. Please wait...</p>
        </>
      )}
    </div>
  );
}
