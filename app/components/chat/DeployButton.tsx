import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useToast } from '~/lib/hooks/useToast';
import * as supabaseDb from '~/lib/persistence/supabase_db';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';

interface DeployResponse {
  success: boolean;
  deployment?: {
    url: string;
  };
  error?: string;
}

interface DeployButtonProps {
  chatId: string;
}

export function DeployButton({ chatId }: DeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const files = useStore(workbenchStore.files);
  const toast = useToast();
  const { userId } = useSupabaseAuth();

  // Check for existing deployment on mount
  useEffect(() => {
    const checkExistingDeployment = async () => {
      try {
        const subdomain = await supabaseDb.getLatestDeploymentUrl(chatId);

        if (subdomain) {
          console.log(subdomain);
          setDeployedUrl(`https://${subdomain}.sprintsolo.dev`);
        }
      } catch (error) {
        console.error('Failed to fetch deployment status:', error);
      }
    };

    checkExistingDeployment();
  }, [chatId]);

  const handleDeploy = async () => {
    if (isDeploying) {
      return;
    }

    try {
      setIsDeploying(true);

      // Check if all files are saved
      await workbenchStore.saveAllFiles();

      // Get urlId
      const chat = await supabaseDb.getMessagesById(userId ?? '', chatId);

      if (!chat) {
        throw new Error('Chat not found.');
      }

      // Process files to remove WORK_DIR prefix
      const processedFiles = Object.entries(files).reduce(
        (acc, [path, file]) => {
          const cleanPath = path.replace('/home/project/', '/');
          acc[cleanPath] = file;

          return acc;
        },
        {} as typeof files,
      );

      // Call api.deploy
      const response = await fetch('/api/deploy-netlify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, urlId: chat.urlId, files: processedFiles }),
      });

      if (!response.ok) {
        throw new Error(`Deploy request failed: ${response.statusText}`);
      }

      const data: DeployResponse = await response.json();

      if (data.success && data.deployment) {
        setDeployedUrl(data.deployment.url);
        toast({
          title: 'Deploy Complete',
          description: `Site has been deployed: ${data.deployment.url}`,
          type: 'success',
        });
      } else {
        throw new Error(data.error || 'An error occurred during deployment.');
      }
    } catch (error: any) {
      console.error('Deploy failed:', error);
      toast({
        title: 'Deploy Failed',
        description: error.message || 'An unknown error occurred.',
        type: 'error',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDeploy}
        disabled={isDeploying}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
          isDeploying
            ? 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-textTertiary cursor-not-allowed'
            : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccentHover border-bolt-elements-borderAccent'
        }`}
      >
        {isDeploying ? (
          <>
            <div className="i-bolt:loading w-4 h-4" />
            <span>Deploying...</span>
          </>
        ) : (
          <>
            <div className="i-ph:cloud-arrow-up-bold w-4 h-4" />
            <span>Deploy</span>
          </>
        )}
      </button>
      {deployedUrl && !isDeploying && (
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
