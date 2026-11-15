import type { ApiSession } from '../types';
import { ApiError, apiFetch, describeApiError, serverDetail } from './http';

export interface SessionInput {
  sessionDate: string;
  content: string;
}

export interface NewSessionInput extends SessionInput {
  sessionNumber: number;
}

export const SESSION_CONTENT_MAX = 20000;

/** GET /api/cases/{caseId}/sessions — 회차 순서대로 온다. */
export async function fetchSessions(caseId: number): Promise<ApiSession[]> {
  return apiFetch<ApiSession[]>(`/api/cases/${caseId}/sessions`);
}

/** GET /api/cases/{caseId}/sessions/{sessionId} */
export async function fetchSession(caseId: number, sessionId: number): Promise<ApiSession> {
  return apiFetch<ApiSession>(`/api/cases/${caseId}/sessions/${sessionId}`);
}

/** POST /api/cases/{caseId}/sessions — 회차 번호가 겹치면 409 */
export async function createSession(caseId: number, input: NewSessionInput): Promise<ApiSession> {
  return apiFetch<ApiSession>(`/api/cases/${caseId}/sessions`, {
    method: 'POST',
    json: { sessionNumber: input.sessionNumber, sessionDate: input.sessionDate, content: input.content.trim() },
  });
}

/** PATCH /api/cases/{caseId}/sessions/{sessionId} — AI 요약이 있는 회기는 409 */
export async function updateSession(caseId: number, sessionId: number, input: SessionInput): Promise<ApiSession> {
  return apiFetch<ApiSession>(`/api/cases/${caseId}/sessions/${sessionId}`, {
    method: 'PATCH',
    json: { sessionDate: input.sessionDate, content: input.content.trim() },
  });
}

/** 서버 규칙과 같은 입력 검사(서버가 최종 검사한다). 문제가 있으면 안내 문구를 돌려준다. */
export function validateSessionInput(input: { sessionNumber?: number | null; sessionDate: string; content: string }): string | null {
  if (input.sessionNumber !== undefined) {
    const n = input.sessionNumber;
    if (n === null || !Number.isInteger(n) || n < 1 || n > 500) return '회차 번호는 1~500 사이의 숫자로 입력해 주세요.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) return '상담 날짜를 선택해 주세요.';
  const length = input.content.trim().length;
  if (length === 0) return '상담 기록을 입력해 주세요.';
  if (length > SESSION_CONTENT_MAX) return `상담 기록은 ${SESSION_CONTENT_MAX.toLocaleString()}자 이하로 입력해 주세요.`;
  return null;
}

/** 회기 저장 오류를 화면 문구로 바꾼다. */
export function describeSessionError(error: unknown, action: 'create' | 'update'): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return action === 'create'
        ? '이미 같은 회차 번호의 기록이 있어요. 회차 번호를 바꿔 주세요.'
        : 'AI 요약이 만들어진 회기는 기록을 고칠 수 없어요.';
    }
    if (error.status === 400) return '입력 내용을 서버가 받아들이지 못했어요. 회차, 날짜, 기록 내용을 확인해 주세요.';
    if (error.status === 404) return '사례나 회기를 찾을 수 없어요. 내게 배정된 사례가 아닐 수 있어요.';
  }
  return describeApiError(error, action === 'create' ? '기록을 저장하지 못했어요.' : '기록을 고치지 못했어요.');
}

export { serverDetail };
