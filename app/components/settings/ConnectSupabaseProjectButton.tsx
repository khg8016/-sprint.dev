import { useEffect, useState, useCallback } from 'react';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { supabase } from '~/lib/persistence/supabaseClient';
import { SupabaseProjectModal } from './SupabaseProjectModal';
import { chatId } from '~/lib/persistence/useChatHistorySupabase';
import { useStore } from '@nanostores/react';

export function ConnectSupabaseProjectButton() {
  const [prefersDark, setPrefersDark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { userId } = useSupabaseAuth();
  const currentChatId = useStore(chatId);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const imageUrl = prefersDark
    ? '/assets/connect-supabase/connect-project-dark.svg'
    : '/assets/connect-supabase/connect-project-light.svg';

  const handleConnect = useCallback(async () => {
    if (isLoading || !userId || !currentChatId) {
      return;
    }

    try {
      setIsLoading(true);

      // 현재 채팅방에 연결된 프로젝트가 있는지 확인
      const { data: existingConnection } = await supabase
        .from('chat_supabase_connections')
        .select('*')
        .eq('chat_id', currentChatId)
        .eq('is_active', true)
        .single();

      if (existingConnection) {
        // 이미 연결된 프로젝트가 있다면 비활성화
        await supabase.from('chat_supabase_connections').update({ is_active: false }).eq('id', existingConnection.id);
      }

      // 프로젝트 선택 모달 표시
      setShowModal(true);
    } catch (error) {
      console.error('Failed to check existing connection:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentChatId, isLoading]);

  return (
    <>
      <button
        onClick={handleConnect}
        className="h-6 opacity-100 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading || !userId || !currentChatId}
        aria-label="Connect Supabase Project"
      >
        <img src={imageUrl} alt="Connect Supabase Project" className="h-full" />
      </button>

      <SupabaseProjectModal isOpen={showModal} onClose={() => setShowModal(false)} chatId={currentChatId || ''} />
    </>
  );
}
