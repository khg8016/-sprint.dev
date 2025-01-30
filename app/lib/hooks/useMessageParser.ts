import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

/*
 * import { useSupabaseManagement } from './useSupabaseManagement';
 * import { useSupabaseAuth } from './useSupabaseAuth';
 */

/*
 * import { supabase } from '~/lib/persistence/supabaseClient';
 * import { useStore } from '@nanostores/react';
 * import { chatStore } from '~/lib/stores/chat';
 */

const logger = createScopedLogger('useMessageParser');

export function useMessageParser() {
  // const { userId } = useSupabaseAuth();

  /*
   * const chat = useStore(chatStore);
   * const { executeQuery } = useSupabaseManagement(userId);
   */

  const [messageParser] = useState(
    () =>
      new StreamingMessageParser({
        callbacks: {
          onArtifactOpen: (data) => {
            logger.trace('onArtifactOpen', data);
            workbenchStore.showWorkbench.set(true);
            workbenchStore.addArtifact(data);
          },
          onArtifactClose: (data) => {
            logger.trace('onArtifactClose');
            workbenchStore.updateArtifact(data, { closed: true });
          },
          onActionOpen: (data) => {
            logger.trace('onActionOpen', data.action);

            if (data.action.type === 'file') {
              workbenchStore.addAction(data);
            }
          },
          onActionClose: async (data) => {
            logger.trace('onActionClose', data.action);
            console.log('onActionClose', data.action);

            if (data.action.type !== 'file') {
              workbenchStore.addAction(data);
            }

            workbenchStore.runAction(data);
          },
          onActionStream: (data) => {
            logger.trace('onActionStream', data.action);
            workbenchStore.runAction(data, true);
          },
        },
      }),
  );

  /*
   * useEffect(() => {
   *   if (userId) {
   *     console.log('useMessageParser', userId);
   *     messageParser.setUserId(userId);
   *   }
   * }, [userId, messageParser]);
   */

  /*
   * useEffect(() => {
   *   if (chat.id) {
   *     console.log('useMessageParser', chat.id);
   *     messageParser.setChatId(chat.id);
   *   }
   * }, [chat.id, messageParser]);
   */

  /*
   * useEffect(() => {
   *   messageParser.setExecuteQuery(executeQuery);
   * }, [executeQuery]);
   */

  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback(
    (messages: Message[]) => {
      for (const [index, message] of messages.entries()) {
        if (message.role === 'assistant') {
          const newParsedContent = messageParser.parse(message.id, message.content);

          setParsedMessages((prevParsed) => ({
            ...prevParsed,
            [index]: (prevParsed[index] || '') + newParsedContent,
          }));
        }
      }
    },
    [messageParser],
  );

  return { parsedMessages, parseMessages };
}
