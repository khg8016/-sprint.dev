import type { Message } from 'ai';
import { supabase } from './supabaseClient';
import type { ChatHistoryItem } from './types';

/**
 * Supabase로부터 받은 레코드를 ChatHistoryItem으로 변환
 */
function convertChatHistoryItem(row: any): ChatHistoryItem {
  return {
    id: row.id,
    userId: row.user_id, // user_id → userId
    messages: row.messages,
    urlId: row.url_id, // url_id → urlId
    description: row.description,
    timestamp: row.timestamp,
  };
}

function convertChatHistoryItems(rows: any[]): ChatHistoryItem[] {
  return rows.map(convertChatHistoryItem);
}

/**
 * (옵션) 에러에서 '0 rows'를 구분해 null 반환할지, 바로 throw할지 결정
 * 여기서는 예시로 null 반환 방식을 사용.
 */
function handleSingleSelectError(error: any): null {
  if (error.details?.includes('0 rows')) {
    return null;
  }

  throw error;
}

/**
 * 1) 특정 유저(userId)의 모든 채팅 목록 가져오기
 */
export async function getAll(userId: string): Promise<ChatHistoryItem[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('id, url_id, description, timestamp', { count: 'exact' })
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return convertChatHistoryItems(data || []);
}

/**
 * 채팅 목록을 페이지네이션으로 가져오기
 */
export async function getPaginatedChats(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ items: ChatHistoryItem[]; hasMore: boolean }> {
  const start = page * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from('chats')
    .select('id, url_id, description, timestamp', { count: 'exact' })
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  return {
    items: convertChatHistoryItems(data || []),
    hasMore: count ? count > (page + 1) * pageSize : false,
  };
}

/**
 * 2) chats 테이블에 메시지 저장/업데이트 (upsert)
 * - userId, id, messages, urlId, description, timestamp
 */
export async function setMessages(
  userId: string,
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
    user_id: userId,
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
 * 3) id 혹은 urlId로 해당 유저의 chats 레코드 가져오기
 *  - 우선 id로 검색 → 없으면 urlId로 검색
 */
export async function getMessages(userId: string, idOrUrl: string): Promise<ChatHistoryItem | null> {
  const byUrlId = await getMessagesByUrlId(userId, idOrUrl);

  if (byUrlId) {
    return byUrlId;
  }

  const byId = await getMessagesById(userId, idOrUrl);

  if (byId) {
    return byId;
  }

  return null;
}

/**
 * 4) urlId로 검색
 */
export async function getMessagesByUrlId(userId: string, urlId: string): Promise<ChatHistoryItem | null> {
  const { data, error } = await supabase.from('chats').select('*').match({ user_id: userId, url_id: urlId }).single();

  if (error) {
    return handleSingleSelectError(error);
  }

  return data ? convertChatHistoryItem(data) : null;
}

/**
 * 5) id로 검색
 */
export async function getMessagesById(userId: string, id: string): Promise<ChatHistoryItem | null> {
  const { data, error } = await supabase.from('chats').select('*').match({ user_id: userId, id }).single();

  if (error) {
    // "0 rows" 오류라면 null 반환
    if (error.details?.includes('0 rows')) {
      return null;
    }

    throw error;
  }

  return data ? convertChatHistoryItem(data) : null;
}

/**
 * 6) 특정 채팅 삭제
 */
export async function deleteById(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('chats').delete().match({ user_id: userId, id });

  if (error) {
    throw error;
  }
}

/**
 * 7) 다음 ID (현재 userId 소유 레코드들 중 최대 id+1)
 *   - indexedDB 로직을 그대로 살린 예시.
 *   - 실제로는 전역적으로 unique한 UUID를 쓰는 편이 나을 수도 있음.
 */
export async function getNextId(userId: string): Promise<string> {
  const { data, error } = await supabase.from('chats').select('id').eq('user_id', userId);

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
 *   - 특정 userId 범위 안에서 url_id 목록 조회
 */
export async function getUrlId(userId: string, id: string): Promise<string> {
  const idList = await getUrlIds(userId);

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

async function getUrlIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('chats').select('url_id').eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.url_id).filter((urlId) => urlId !== null);
}

/**
 * 9) forkChat: 특정 messageId까지의 대화만 복사해 새 Chat 생성
 */
export async function forkChat(userId: string, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(userId, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  const messages = chat.messages.slice(0, messageIndex + 1);
  const newDesc = chat.description ? `${chat.description} (fork)` : 'Forked chat';

  return createChatFromMessages(userId, newDesc, messages);
}

/**
 * 10) duplicateChat: 전체 대화를 복사해 새 Chat 생성
 */
export async function duplicateChat(userId: string, id: string): Promise<string> {
  const chat = await getMessages(userId, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  const newDesc = chat.description ? `${chat.description} (copy)` : 'Chat (copy)';

  return createChatFromMessages(userId, newDesc, chat.messages);
}

/**
 * 11) 기존 메시지 배열로 새 Chat 생성
 */
export async function createChatFromMessages(
  userId: string,
  description: string,
  messages: Message[],
): Promise<string> {
  const newId = await getNextId(userId);
  const newUrlId = await getUrlId(userId, newId);

  await setMessages(userId, newId, messages, newUrlId, description);

  return newUrlId;
}

/**
 * 12) 채팅 설명 업데이트
 */
export async function updateChatDescription(userId: string, id: string, newDescription: string): Promise<void> {
  const chat = await getMessages(userId, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!newDescription.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(userId, id, chat.messages, chat.urlId, newDescription, chat.timestamp);
}
