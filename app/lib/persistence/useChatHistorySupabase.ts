import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import { getMessages, getNextId, getUrlId, setMessages, duplicateChat, createChatFromMessages } from './supabase_db';

/*
 * export interface ChatHistoryItem {
 *   id: string;
 *   urlId?: string;
 *   description?: string;
 *   messages: Message[];
 *   timestamp: string;
 * }
 */

// Remix 환경변수: persistence를 껐다 켤 수 있는 옵션
const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Nanostores
export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

/**
 * Supabase 기반의 Chat History 훅
 * - 기존 useChatHistory.ts에서 IndexedDB 로직을 Supabase 연동으로 대체
 */
export function useChatHistorySupabase() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  /**
   * 초기 로딩 시점:
   * 1) persistence가 꺼져 있으면 에러 처리 후 종료
   * 2) loaderData로 넘어온 chat id(mixedId)가 있으면 해당 Chat 불러오기
   */
  useEffect(() => {
    // 1) Supabase 사용이 불가능하거나, persistence가 꺼져 있는 경우
    if (!persistenceEnabled) {
      setReady(true);

      const error = new Error('Chat persistence is unavailable');
      logStore.logError('Chat persistence initialization failed', error);
      toast.error('Chat persistence is unavailable');

      return;
    }

    // 2) loaderData로 넘어온 chat id가 있는 경우 => DB에서 메시지 가져오기
    if (mixedId) {
      getMessages(mixedId)
        .then((storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            const rewindId = searchParams.get('rewindTo');

            // URL에 ?rewindTo=someMessageId 가 있으면, 해당 메시지까지만 보여줌
            const filteredMessages = rewindId
              ? storedMessages.messages.slice(0, storedMessages.messages.findIndex((m) => m.id === rewindId) + 1)
              : storedMessages.messages;

            setInitialMessages(filteredMessages);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
          } else {
            // 해당 id의 대화가 없으면 루트('/')로 돌려보냄
            navigate('/', { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          logStore.logError('Failed to load chat messages', error);
          toast.error(error.message);
        });
    } else {
      // loaderData에 chat id가 없는 경우 (새 채팅 등) => 바로 준비 완료
      setReady(true);
    }
  }, [mixedId, searchParams, navigate]);

  /**
   * 외부에서 사용할 함수들
   */
  return {
    /**
     * 현재 Chat 불러오기가 끝났는지 여부
     * loaderData가 없는 경우(true) or DB 조회 완료 후 true
     */
    ready: !mixedId || ready,

    /**
     * 컴포넌트가 처음 그려질 때 불러온 메시지 목록
     */
    initialMessages,

    /**
     * 새 메시지를 저장(업데이트)하는 메서드
     */
    storeMessageHistory: async (messages: Message[]) => {
      if (!persistenceEnabled || messages.length === 0) {
        return;
      }

      // workbench에서 가져온 Artifact(예: 대화 생성에 관여한 객체)
      const { firstArtifact } = workbenchStore;

      // 아직 urlId가 없고, 첫 아티팩트가 있다면 => urlId 생성
      if (!urlId && firstArtifact?.id) {
        const newUrl = await getUrlId(firstArtifact.id);
        navigateChat(newUrl);
        setUrlId(newUrl);
      }

      // 대화 description이 없고, 아티팩트에 title이 있다면 => description 설정
      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact.title);
      }

      // 처음 채팅 저장 시 chatId가 없으면 => 새 chatId, urlId 생성
      if (initialMessages.length === 0 && !chatId.get()) {
        const next = await getNextId();
        chatId.set(next);

        // urlId도 없으면 navigateChat
        if (!urlId) {
          navigateChat(next);
        }
      }

      // 실제 Supabase DB에 저장 (Upsert)
      await setMessages(chatId.get() as string, messages, urlId, description.get());
    },

    /**
     * 현재 Chat을 복제(duplicate)하는 메서드
     */
    duplicateCurrentChat: async (listItemId: string) => {
      if (!persistenceEnabled) {
        return;
      }

      // mixedId(로드된 채팅 id)가 없고, 별도 파라미터도 없으면 복제 불가
      if (!mixedId && !listItemId) {
        return;
      }

      try {
        const newId = await duplicateChat(mixedId || listItemId);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.error(error);
      }
    },

    /**
     * 외부 JSON 대화 데이터를 임포트해 새 Chat을 생성
     */
    importChat: async (newDescription: string, messages: Message[]) => {
      if (!persistenceEnabled) {
        return;
      }

      try {
        const newId = await createChatFromMessages(newDescription, messages);
        window.location.href = `/chat/${newId}`;
        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },

    /**
     * 현재 Chat을 JSON 파일로 내보내기
     */
    exportChat: async (id = urlId) => {
      if (!persistenceEnabled || !id) {
        return;
      }

      const chat = await getMessages(id);

      if (!chat) {
        toast.error('Cannot export: Chat not found');
        return;
      }

      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      // JSON으로 변환 후 다운로드
      const blob = new Blob([JSON.stringify(chatData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * 히스토리를 바꾸지 않고 URL만 교체하는 유틸
 * - Remix의 navigate()를 쓰면 App이 전체 리로드되거나, 새롭게 렌더링되는 문제가 있을 수 있어 직접 구현
 */
function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;
  window.history.replaceState({}, '', url);
}
