import type { ApiIntake, ApiIntakeAccepted, ApiIntakePage, ApiCase, CaseRow } from '../types';
import { ApiError, apiFetch, describeApiError } from './http';
import { toCaseRow } from './remoteCaseApi';

export interface IntakeSubmission {
  applicantName: string;
  applicantContact: string;
  concernCategory: string;
  concernDescription: string;
  hasPriorCounseling: boolean | null;
  privacyConsent: boolean;
}

/**
 * POST /api/intakes — 비회원 상담 신청(로그인 없이 가능, 응답에 신청 내용은 없다).
 * 개인정보 수집·이용에 동의하지 않으면 서버가 400으로 거절한다.
 */
export async function submitIntake(input: IntakeSubmission): Promise<ApiIntakeAccepted> {
  const contact = input.applicantContact.trim();
  return apiFetch<ApiIntakeAccepted>('/api/intakes', {
    method: 'POST',
    json: {
      applicantName: input.applicantName.trim(),
      applicantContact: contact === '' ? null : contact,
      concernCategory: input.concernCategory.trim(),
      concernDescription: input.concernDescription.trim(),
      hasPriorCounseling: input.hasPriorCounseling,
      privacyConsent: input.privacyConsent,
    },
  });
}

/** 서버 규칙: 이름 1~100자, 연락처 50자 이하, 분야 1~50자, 고민 1~2000자, 동의 필수 */
export function validateIntake(input: IntakeSubmission): string | null {
  const name = input.applicantName.trim();
  if (!name || name.length > 100) return '이름(별칭)은 1~100자로 입력해 주세요.';
  if (input.applicantContact.trim().length > 50) return '연락처는 50자 이하로 입력해 주세요.';
  if (!input.concernCategory.trim()) return '상담받고 싶은 분야를 선택해 주세요.';
  const concern = input.concernDescription.trim();
  if (!concern) return '고민 내용을 입력해 주세요.';
  if (concern.length > 2000) return '고민 내용은 2,000자 이하로 입력해 주세요.';
  if (!input.privacyConsent) return '개인정보 수집·이용에 동의해야 신청할 수 있어요.';
  return null;
}

export function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return '입력 내용을 서버가 받아들이지 못했어요. 필수 항목과 글자 수, 개인정보 동의를 확인해 주세요.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return '보안 확인에 실패했어요. 화면을 새로고침한 뒤 다시 시도해 주세요.';
  }
  return describeApiError(error, '상담 신청을 제출하지 못했어요.');
}

/** GET /api/admin/intakes — 관리자 전용. status를 주면 그 상태만 온다. */
export async function fetchIntakes(page = 0, size = 20, status?: 'SUBMITTED' | 'PROCESSED'): Promise<ApiIntakePage> {
  const query: Record<string, string | number> = { page, size };
  if (status) query.status = status;
  return apiFetch<ApiIntakePage>('/api/admin/intakes', { query });
}

/** GET /api/admin/intakes/{id} */
export async function fetchIntake(id: number): Promise<ApiIntake> {
  return apiFetch<ApiIntake>(`/api/admin/intakes/${id}`);
}

/** POST /api/admin/intakes/{id}/convert — 내담자와 미배정 사례를 만들고 접수를 처리됨으로 바꾼다(201). */
export async function convertIntake(id: number): Promise<CaseRow> {
  const data = await apiFetch<ApiCase>(`/api/admin/intakes/${id}/convert`, { method: 'POST' });
  return toCaseRow(data);
}

export function describeConvertError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return '이미 처리된 신청이거나 개인정보 동의가 기록되지 않은 신청이라 전환할 수 없어요.';
    if (error.status === 404) return '신청서를 찾을 수 없어요.';
  }
  return describeApiError(error, '신청서를 사례로 전환하지 못했어요.');
}
