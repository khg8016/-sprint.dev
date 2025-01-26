import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { ConnectSupabaseButton } from '~/components/settings/ConnectSupabaseButton';
import { GoToSupabaseProjectButton } from '~/components/settings/GoToSupabaseProjectButton';
import { ConnectChatToProjectButton } from '~/components/settings/ConnectChatToProjectButton';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { supabase } from '~/lib/persistence/supabaseClient';
import { useEffect, useState, useCallback } from 'react';
import { useSupabaseManagement } from '~/lib/hooks/useSupabaseManagement';
import { DeployButton } from '~/components/chat/DeployButton';

// import { DeployButton } from '~/components/chat/DeployButton';

interface HeaderActionButtonsProps {
  isStreaming: boolean;
  sendMessage: (messageInput?: string) => void;
}

export function HeaderActionButtons({ isStreaming, sendMessage }: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const chat = useStore(chatStore);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;

  const { userId } = useSupabaseAuth();
  const [chatProject, setChatProject] = useState<{ id: string } | null>(null);
  const [hasSupabaseToken, setHasSupabaseToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has Supabase token
  useEffect(() => {
    if (userId) {
      supabase
        .from('supabase_tokens')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .then(({ data }) => {
          setHasSupabaseToken(!!data?.length);
        });
    }
  }, [userId]);

  const loadChatProject = useCallback(async () => {
    if (!userId || !chat.id) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from('chat_supabase_connections')
      .select('project_id')
      .eq('chat_id', chat.id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    setChatProject(data ? { id: data.project_id } : null);
    setIsLoading(false);
  }, [userId, chat.id]);

  useEffect(() => {
    loadChatProject();
  }, [loadChatProject]);

  // Listen for project connection updates
  useEffect(() => {
    const handleProjectConnected = () => {
      loadChatProject();
    };

    window.addEventListener('supabaseProjectConnected', handleProjectConnected);

    return () => {
      window.removeEventListener('supabaseProjectConnected', handleProjectConnected);
    };
  }, [loadChatProject]);

  const { getProjectApiKeys } = useSupabaseManagement(userId);
  useEffect(() => {
    // Get project API keys
    if (chatProject) {
      getProjectApiKeys(chatProject.id).then((apiKeys) => {
        const anonKey = apiKeys.find((key) => key.name === 'anon')?.api_key;

        workbenchStore.setEnvFile(`VITE_SUPABASE_ANON_KEY=${anonKey}
VITE_SUPABASE_URL=https://${chatProject.id}.supabase.co`);
      });
    }
  }, [chatProject]);

  return (
    <div className="flex items-center gap-3">
      {chat.id && (
        <DeployButton
          chatId={chat.id}
          isStreaming={isStreaming}
          onSendMessage={async (message) => {
            if (sendMessage) {
              sendMessage(message);
            }
          }}
        />
      )}
      {userId && !hasSupabaseToken && chat.id ? (
        <ConnectSupabaseButton chatId={chat.id} />
      ) : !isLoading && chatProject ? (
        <GoToSupabaseProjectButton projectId={chatProject.id} />
      ) : chat.id && hasSupabaseToken ? (
        <ConnectChatToProjectButton chatId={chat.id} />
      ) : null}

      {/* {chat.id && <DeployButton chatId={chat.id} />} */}
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's not needed
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5', {
        'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
          !active,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
        'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
