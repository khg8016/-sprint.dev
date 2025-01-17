import { useState, useCallback } from 'react';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { supabase } from '~/lib/persistence/supabaseClient';
import { SupabaseProjectModal } from './SupabaseProjectModal';

interface ConnectChatToProjectButtonProps {
  chatId: string;
}

export function ConnectChatToProjectButton({ chatId }: ConnectChatToProjectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { userId } = useSupabaseAuth();

  const handleConnect = useCallback(async () => {
    if (isLoading || !userId || !chatId) {
      return;
    }

    try {
      setIsLoading(true);

      // 현재 채팅방에 연결된 프로젝트가 있는지 확인
      const { data: existingConnection } = await supabase
        .from('chat_supabase_connections')
        .select('*')
        .eq('chat_id', chatId)
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
  }, [userId, chatId, isLoading]);

  return (
    <>
      <button
        onClick={handleConnect}
        className="inline-flex items-center justify-center rounded-md border border-[#3ECF8E] bg-[#3ECF8E]/10 px-4 py-2 text-sm font-medium text-[#3ECF8E] hover:bg-[#3ECF8E]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-2"
        disabled={isLoading || !userId || !chatId}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5 text-[#3ECF8E]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <img src="/assets/brand-assets/supabase-logo-icon.svg" alt="" className="h-5 w-5" />
        )}
        <span>Connect to Project</span>
      </button>

      <SupabaseProjectModal isOpen={showModal} onClose={() => setShowModal(false)} chatId={chatId} />
    </>
  );
}
