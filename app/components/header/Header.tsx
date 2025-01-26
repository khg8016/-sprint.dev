import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

interface Props {
  isStreaming: boolean;
  sendMessage: (messageInput?: string) => void;
}

export function Header({ isStreaming, sendMessage }: Props) {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <div>SprintSolo.dev</div>
        </a>
      </div>
      <ClientOnly>
        {() =>
          chat.started && (
            <>
              <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
                <ChatDescription />
              </span>
              <div className="mr-1">
                <HeaderActionButtons isStreaming={isStreaming} sendMessage={sendMessage} />
              </div>
            </>
          )
        }
      </ClientOnly>
    </header>
  );
}
