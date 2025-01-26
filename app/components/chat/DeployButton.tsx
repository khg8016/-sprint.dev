import { useState, useEffect } from 'react';
import { useToast } from '~/lib/hooks/useToast';
import * as supabaseDb from '~/lib/persistence/supabase_db';

interface DeployButtonProps {
  chatId: string;
  onSendMessage?: (message: string) => Promise<void>;
  isStreaming: boolean;
}

export function DeployButton({ chatId, onSendMessage, isStreaming }: DeployButtonProps) {
  /*
   * const [isDeploying, setIsDeploying] = useState(false);
   * const [waitingForAI, setWaitingForAI] = useState(false);
   */
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  // const files = useStore(workbenchStore.files);
  const toast = useToast();

  // const { userId } = useSupabaseAuth();

  // Check for existing deployment on mount
  useEffect(() => {
    const checkExistingDeployment = async () => {
      try {
        const subdomain = await supabaseDb.getLatestDeploymentUrl(chatId);

        if (subdomain) {
          setDeployedUrl(`https://${subdomain}.sprintsolo.dev`);
        }
      } catch (error) {
        console.error('Failed to fetch deployment status:', error);
      }
    };

    checkExistingDeployment();
  }, [chatId]);

  /*
   * const startDeployment = async () => {
   *   try {
   *     // 파일 저장
   *     await workbenchStore.saveAllFiles();
   */

  /*
   *     // urlId 가져오기
   *     const chat = await supabaseDb.getMessagesById(userId ?? '', chatId);
   */

  /*
   *     if (!chat) {
   *       throw new Error('Chat not found.');
   *     }
   */

  /*
   *     // 파일 경로 처리
   *     const processedFiles = Object.entries(files).reduce(
   *       (acc, [path, file]) => {
   *         const cleanPath = path.replace('/home/project/', '/');
   *         acc[cleanPath] = file;
   */

  /*
   *         return acc;
   *       },
   *       {} as typeof files,
   *     );
   */

  /*
   *     // 배포 요청
   *     const response = await fetch('/api/deploy-netlify', {
   *       method: 'POST',
   *       headers: {
   *         'Content-Type': 'application/json',
   *       },
   *       body: JSON.stringify({ chatId, urlId: chat.urlId, files: processedFiles }),
   *     });
   */

  /*
   *     if (!response.ok) {
   *       throw new Error(`Deploy request failed: ${response.statusText}`);
   *     }
   */

  //     const data: DeployResponse = await response.json();

  /*
   *     if (data.success && data.deployment) {
   *       setIsDeploying(false);
   *       setDeployedUrl(data.deployment.url);
   *       toast({
   *         title: 'Deploy Complete',
   *         description: `Site has been deployed: ${data.deployment.url}`,
   *         type: 'success',
   *       });
   *     } else {
   *       throw new Error(data.error || 'An error occurred during deployment.');
   *     }
   *   } catch (error: any) {
   *     throw new Error('배포 중 오류가 발생했습니다: ' + error.message);
   *   }
   * };
   */

  const handleDeploy = async () => {
    try {
      if (!onSendMessage) {
        return;
      }

      // AI 검증 시작

      // setWaitingForAI(true);

      try {
        // AI에게 "빌드해" 메시지 전송
        await onSendMessage('Deploy');

        // setIsDeploying(true);

        // AI 응답이 완료되면 배포 시작

        // setWaitingForAI(false);
      } catch (error) {
        throw new Error('Deploy process failed: ' + (error as Error).message);
      }
    } catch (error: any) {
      console.error('Deploy process failed:', error);
      toast({
        title: 'Deploy Failed',
        description: error.message || 'An unknown error occurred.',
        type: 'error',
      });
    } finally {
      // setWaitingForAI(false);
    }
  };

  // const artifacts = useStore(workbenchStore.artifacts);

  // const artifact = artifacts[lastMessageId];

  /*
   * const actions = useStore(
   *   computed(artifact.runner.actions, (actions) => {
   *     return Object.values(actions);
   *   }),
   * );
   */

  /*
   * useEffect(() => {
   *   if (lastMessageId) {
   *     const allActionsDone = actions.every((action) => action.status === 'complete');
   */

  /*
   *     if (!isStreaming && isDeploying && allActionsDone) {
   *       startDeployment();
   *     }
   *   }
   * }, [isStreaming, isDeploying, lastMessageId, actions]);
   */

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDeploy}
        disabled={isStreaming}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
          isStreaming
            ? 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-textTertiary cursor-not-allowed'
            : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccentHover border-bolt-elements-borderAccent'
        }`}
      >
        <div className="i-ph:cloud-arrow-up-bold w-4 h-4" />
        <span>Deploy</span>
      </button>
      {deployedUrl && (
        <button
          onClick={() => window.open(`${deployedUrl}`, '_blank')}
          className="flex items-center gap-2 px-3 py-1.5 rounded border bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
          title="Open deployed site"
        >
          <div className="i-ph:arrow-square-out-bold w-4 h-4" />
        </button>
      )}
    </div>
  );
}
