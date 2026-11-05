import type { ApiCase, ApiClient, ApiCounselorAccount } from '../types';
import { apiFetch } from './http';

export interface NewCounselorInput {
  email: string;
  name: string;
  password: string;
}

/** GET /api/admin/counselors — 상담사 계정 목록(ADMIN 전용). 관리자 계정은 목록에 없다. */
export async function fetchCounselors(): Promise<ApiCounselorAccount[]> {
  return apiFetch<ApiCounselorAccount[]>('/api/admin/counselors');
}

/**
 * POST /api/admin/counselors — 상담사 계정 등록(ADMIN 전용). 성공하면 201.
 * 이메일이 이미 있으면 409, 형식이 틀리면 400이다.
 * 비밀번호는 서버로 보내기만 하고 화면·저장소에 남기지 않는다.
 */
export async function createCounselor(input: NewCounselorInput): Promise<ApiCounselorAccount> {
  return apiFetch<ApiCounselorAccount>('/api/admin/counselors', {
    method: 'POST',
    json: { email: input.email.trim().toLowerCase(), name: input.name.trim(), password: input.password },
  });
}

/** 백엔드 규칙과 같은 입력 검사(서버가 최종 검사한다). 문제가 있으면 안내 문구를 돌려준다. */
export function validateCounselorInput(input: NewCounselorInput): string | null {
  const email = input.email.trim();
  if (!input.name.trim() || input.name.trim().length > 100) return '이름은 1~100자로 입력해 주세요.';
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '이메일 형식이 올바르지 않아요.';
  const bytes = new TextEncoder().encode(input.password).length;
  if (input.password.length < 12 || bytes > 72) return '비밀번호는 12자 이상, 72바이트 이하로 입력해 주세요.';
  return null;
}

/* ------------------------------------------------------------------ */
/* 내담자 등록 · 사례 생성 · 상담사 배정 (모두 ADMIN 전용)                 */
/* ------------------------------------------------------------------ */

export interface NewClientInput {
  name: string;
  contact: string;
}

/** POST /api/admin/clients — 내담자 등록(201). 연락처는 비워 두면 null로 보낸다. */
export async function createClient(input: NewClientInput): Promise<ApiClient> {
  const contact = input.contact.trim();
  return apiFetch<ApiClient>('/api/admin/clients', {
    method: 'POST',
    json: { name: input.name.trim(), contact: contact === '' ? null : contact },
  });
}

/** 서버 규칙: 이름 1~100자, 연락처 50자 이하 */
export function validateClientInput(input: NewClientInput): string | null {
  const name = input.name.trim();
  if (!name || name.length > 100) return '이름(가명)은 1~100자로 입력해 주세요.';
  if (input.contact.trim().length > 50) return '연락처는 50자 이하로 입력해 주세요.';
  return null;
}

export interface NewCaseInput {
  clientId: number;
  /** null이면 상담사를 정하지 않은(미배정) 사례로 만든다 */
  counselorId: number | null;
  title: string;
}

/** POST /api/admin/cases — 사례 생성(201). 응답은 사례 조회와 같은 모양이다. */
export async function createCase(input: NewCaseInput): Promise<ApiCase> {
  return apiFetch<ApiCase>('/api/admin/cases', {
    method: 'POST',
    json: { clientId: input.clientId, counselorId: input.counselorId, title: input.title.trim() },
  });
}

/** 서버 규칙: 내담자 번호 1 이상, 제목 1~200자 */
export function validateCaseInput(input: { clientId: number | null; title: string }): string | null {
  if (input.clientId === null || !Number.isInteger(input.clientId) || input.clientId < 1) {
    return '내담자 번호는 1 이상의 숫자로 입력해 주세요.';
  }
  const title = input.title.trim();
  if (!title || title.length > 200) return '사례 제목은 1~200자로 입력해 주세요.';
  return null;
}

/**
 * PATCH /api/admin/cases/{id}/assignment — 상담사 배정(200).
 * counselorId를 null로 보내면 배정을 해제한다.
 * 사용 중인 상담사 계정만 배정할 수 있다(아니면 400).
 */
export async function assignCase(caseId: number, counselorId: number | null): Promise<ApiCase> {
  return apiFetch<ApiCase>(`/api/admin/cases/${caseId}/assignment`, {
    method: 'PATCH',
    json: { counselorId },
  });
}

/** 상담사 번호 → 이름. 목록을 못 불러오면 빈 객체를 돌려주고 화면은 번호(#15)로 표시한다. */
export async function fetchCounselorNames(): Promise<Record<number, string>> {
  try {
    const list = await fetchCounselors();
    return Object.fromEntries(list.map((c) => [c.id, c.name]));
  } catch {
    return {};
  }
}

export function counselorLabel(names: Record<number, string>, id: number | null): string {
  if (id === null) return '미배정';
  return names[id] ? `${names[id]} (#${id})` : `#${id}`;
}
