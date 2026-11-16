import { ApiError, apiFetch } from './http';

/**
 * 챗봇 서버 API — POST /api/chatbot/message (로그인 없이 쓰는 공개 API).
 * 요청: { "message": "..." }  응답: { "reply": "...", "type": "GUIDE|CRISIS|FALLBACK", "action": "OPEN_INTAKE|SHOW_HELP|SHOW_MENU|null" }
 * 로그인하지 않아도 /api/auth/csrf 토큰과 세션 쿠키가 필요하며, 공통 apiFetch가 알아서 처리한다.
 * API 키나 AI 서버 접근 토큰은 프론트엔드에 두지 않는다(서버가 중계한다).
 */
export type ChatReplyType = 'GUIDE' | 'CRISIS' | 'FALLBACK';
export type ChatReplyAction = 'OPEN_INTAKE' | 'SHOW_HELP' | 'SHOW_MENU' | null;

export interface ChatReply {
  reply: string;
  /** 모르는 값이 와도 화면은 reply를 그대로 보여준다 */
  type: ChatReplyType | string;
  action: ChatReplyAction | string | null;
}

/** AI 응답을 기다리는 최대 시간. 넘으면 고정 안내 문구를 보여준다. */
export const CHAT_TIMEOUT_MS = 30_000;
/** 한 번에 보낼 수 있는 글자 수(서버 제한이 정해지면 이 값을 맞춘다) */
export const CHAT_MESSAGE_MAX = 500;

export async function sendChatMessage(message: string): Promise<ChatReply> {
  const data = await apiFetch<Partial<ChatReply> | undefined>('/api/chatbot/message', {
    method: 'POST',
    json: { message: message.trim().slice(0, CHAT_MESSAGE_MAX) },
    timeoutMs: CHAT_TIMEOUT_MS,
  });
  if (!data || typeof data.reply !== 'string' || data.reply.trim() === '') {
    throw new ApiError(502, '챗봇 응답 형식이 올바르지 않아요.', data);
  }
  return { reply: data.reply, type: data.type ?? 'GUIDE', action: data.action ?? null };
}

/** 위기 응답인지. type이 CRISIS이거나 action이 SHOW_HELP이면 위기 안내 화면으로 처리한다. */
export function isCrisisReply(reply: ChatReply): boolean {
  return reply.type === 'CRISIS' || reply.action === 'SHOW_HELP';
}
