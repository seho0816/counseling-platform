import type { ApiSummary, ApiSummaryFields } from '../types';
import { ApiError, apiFetch, describeApiError } from './http';

export const SUMMARY_FIELD_MAX = 5000;

/** GET /api/sessions/{sessionId}/summary — 요약이 아직 없으면(404) null을 돌려준다. */
export async function fetchSummary(sessionId: number): Promise<ApiSummary | null> {
  try {
    return await apiFetch<ApiSummary>(`/api/sessions/${sessionId}/summary`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * POST /api/sessions/{sessionId}/summary/generate — AI 초안을 만든다(201). 자동 확정은 하지 않는다.
 * AI가 연결되지 않았으면 503, AI 응답이 잘못됐으면 502, 이미 있으면 409.
 */
export async function generateSummary(sessionId: number): Promise<ApiSummary> {
  return apiFetch<ApiSummary>(`/api/sessions/${sessionId}/summary/generate`, { method: 'POST' });
}

/** PUT /api/sessions/{sessionId}/summary/confirm — 상담사가 검토한 내용으로 승인(상담사만 가능). */
export async function confirmSummary(sessionId: number, fields: ApiSummaryFields): Promise<ApiSummary> {
  return apiFetch<ApiSummary>(`/api/sessions/${sessionId}/summary/confirm`, {
    method: 'PUT',
    json: {
      finalSummary: {
        complaint: toNullable(fields.complaint),
        intervention: toNullable(fields.intervention),
        nextPlan: toNullable(fields.nextPlan),
      },
    },
  });
}

function toNullable(value: string | null): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** 승인 전 입력 검사: 최소 한 항목은 있어야 하고 각 항목은 5000자 이하(서버 규칙). */
export function validateSummaryFields(fields: ApiSummaryFields): string | null {
  const values = [fields.complaint, fields.intervention, fields.nextPlan].map((v) => (v ?? '').trim());
  if (values.every((v) => v === '')) return '요약 항목을 한 가지 이상 입력해 주세요.';
  if (values.some((v) => v.length > SUMMARY_FIELD_MAX)) return `각 항목은 ${SUMMARY_FIELD_MAX.toLocaleString()}자 이하로 입력해 주세요.`;
  return null;
}

/**
 * 요약 생성 오류를 화면 문구로 바꾼다. 실제 서버가 AI 서비스 결과를 이렇게 구분해서 돌려준다.
 * 400 기록이 비었거나 AI가 받을 수 없는 내용, 413 기록이 너무 김, 429 호출 한도, 502 AI 응답 오류,
 * 503 AI 서비스에 연결할 수 없음, 409 이미 요약 있음, 404 회기 없음.
 */
export function describeGenerateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.timeout) return 'AI 요약이 너무 오래 걸려서 멈췄어요. 잠시 뒤에 다시 시도해 주세요.';
    if (error.status === 400) return '이 상담 기록으로는 요약을 만들 수 없어요. 기록 내용을 확인해 주세요.';
    if (error.status === 413) return '상담 기록이 너무 길어서 AI가 요약하지 못해요. 기록을 나누어 쓰거나 줄여 주세요.';
    if (error.status === 429) return 'AI 호출 한도를 넘었어요. 잠시 뒤에 다시 시도해 주세요.';
    if (error.status === 502) return 'AI가 올바른 요약을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
    if (error.status === 503 || error.status === 504) {
      return 'AI 요약 서비스에 연결하지 못했어요. 한동안 쓰지 않았다면 서비스가 깨어나는 데 1분쯤 걸릴 수 있으니, 잠시 뒤에 다시 시도해 주세요. 계속 안 되면 관리자에게 알려 주세요.';
    }
    if (error.status === 409) return '이 회기에는 이미 요약이 있어요.';
    if (error.status === 404) return '회기를 찾을 수 없어요. 내게 배정된 사례가 아닐 수 있어요.';
  }
  return describeApiError(error, 'AI 요약을 만들지 못했어요.');
}

/** 요약 승인 오류를 화면 문구로 바꿀 때 쓴다. */
export function describeConfirmError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return '이미 승인된 요약이에요. 화면을 새로 불러올게요.';
    if (error.status === 403) return '요약 승인은 담당 상담사만 할 수 있어요.';
    if (error.status === 400) return '요약 내용을 서버가 받아들이지 못했어요. 항목을 한 가지 이상, 각 5,000자 이하로 입력해 주세요.';
    if (error.status === 404) return '요약을 찾을 수 없어요. 먼저 AI 요약을 만들어 주세요.';
  }
  return describeApiError(error, '요약을 승인하지 못했어요.');
}
