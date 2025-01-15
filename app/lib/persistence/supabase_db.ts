import type { Message } from 'ai';
import { supabase } from './supabaseClient';
import type { ChatHistoryItem } from './types';

// import { createScopedLogger } from '~/utils/logger';

// const logger = createScopedLogger('ChatHistory');

function convertChatHistoryItem(row: any): ChatHistoryItem {
  return {
    id: row.id,
    messages: row.messages,
    urlId: row.url_id, // 스네이크 케이스 -> CamelCase
    description: row.description,
    timestamp: row.timestamp,
  };
}

function convertChatHistoryItems(rows: any[]): ChatHistoryItem[] {
  return rows.map(convertChatHistoryItem);
}

/**
 * 1) DB에서 모든 chats 가져오기
 */
export async function getAll(): Promise<ChatHistoryItem[]> {
  const { data, error } = await supabase.from('chats').select('*');

  if (error) {
    throw error;
  }

  return convertChatHistoryItems(data || []);
}

/**
 * 2) chats 테이블에 메시지 저장/업데이트 (upsert)
 */
export async function setMessages(
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
): Promise<void> {
  if (timestamp && isNaN(Date.parse(timestamp))) {
    throw new Error('Invalid timestamp');
  }

  const nowString = new Date().toISOString();

  const { error } = await supabase.from('chats').upsert({
    id,
    messages,
    url_id: urlId,
    description,
    timestamp: timestamp ?? nowString,
  });

  if (error) {
    throw error;
  }
}

/**
 * 3) id 혹은 urlId로 chats 레코드 가져오기
 */
export async function getMessages(id: string): Promise<ChatHistoryItem | null> {
  const byId = await getMessagesById(id);

  if (byId) {
    return byId;
  }

  const byUrlId = await getMessagesByUrlId(id);

  if (byUrlId) {
    return byUrlId;
  }

  return null;
}

/**
 * 4) urlId 로 검색
 */
export async function getMessagesByUrlId(id: string): Promise<ChatHistoryItem | null> {
  const { data, error } = await supabase.from('chats').select('*').eq('url_id', id).single();

  if (error) {
    // 없는 경우도 error 처리될 수 있으므로 분기 처리
    if (error.details?.includes('0 rows')) {
      return null;
    }

    throw error;
  }

  return data ? convertChatHistoryItem(data) : null;
}

/**
 * 5) id 로 검색
 */
export async function getMessagesById(id: string): Promise<ChatHistoryItem | null> {
  const { data, error } = await supabase.from('chats').select('*').eq('id', id).single();

  if (error) {
    if (error.details?.includes('0 rows')) {
      return null;
    }

    throw error;
  }

  return data ? convertChatHistoryItem(data) : null;
}

/**
 * 6) id 기준으로 삭제
 */
export async function deleteById(id: string): Promise<void> {
  const { error } = await supabase.from('chats').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * 7) 다음 ID(기존 id 중 최대값+1)
 */
export async function getNextId(): Promise<string> {
  const { data, error } = await supabase.from('chats').select('id');

  if (error) {
    throw error;
  }

  // id를 숫자로 변환
  const ids = (data ?? []).map((chat) => Number(chat.id)).filter((n) => !isNaN(n));

  const highestId = Math.max(0, ...ids);

  return String(highestId + 1);
}

/**
 * 8) urlId 중복 방지 로직
 */
export async function getUrlId(id: string): Promise<string> {
  const idList = await getUrlIds();

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(): Promise<string[]> {
  const { data, error } = await supabase.from('chats').select('url_id');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.url_id).filter((urlId) => urlId !== null);
}

/**
 * 9) forkChat: 특정 messageId까지의 대화만 복사해 새 Chat 생성
 */
export async function forkChat(chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  const messages = chat.messages.slice(0, messageIndex + 1);
  const newDesc = chat.description ? `${chat.description} (fork)` : 'Forked chat';

  return createChatFromMessages(newDesc, messages);
}

/**
 * 10) duplicateChat: 전체 대화를 복사해 새 Chat 생성
 */
export async function duplicateChat(id: string): Promise<string> {
  const chat = await getMessages(id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  const newDesc = chat.description ? `${chat.description} (copy)` : 'Chat (copy)';

  return createChatFromMessages(newDesc, chat.messages);
}

/**
 * 11) 기존 메시지 배열로 새 Chat 생성
 */
export async function createChatFromMessages(description: string, messages: Message[]): Promise<string> {
  const newId = await getNextId();
  const newUrlId = await getUrlId(newId);

  await setMessages(newId, messages, newUrlId, description);

  return newUrlId;
}

/**
 * 12) 채팅 설명 업데이트
 */
export async function updateChatDescription(id: string, description: string): Promise<void> {
  const chat = await getMessages(id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(id, chat.messages, chat.urlId, description, chat.timestamp);
}
