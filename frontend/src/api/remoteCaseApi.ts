import { toStatusLabel } from '../constants/labels';
import type { ApiCase, ApiCasePage, CaseRow } from '../types';
import { apiFetch } from './http';

export interface CasePage {
  items: CaseRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** 백엔드 응답 한 건을 화면용으로 바꾼다. (id 숫자, 영어 상태, null 가능 필드를 처리) */
export function toCaseRow(item: ApiCase): CaseRow {
  const status = toStatusLabel(String(item.status));
  return {
    id: item.id,
    clientId: item.clientId,
    alias: item.clientAlias?.trim() || `내담자 #${item.clientId}`,
    ageGroup: item.ageGroup ?? null,
    concern: item.concern ?? null,
    title: item.title,
    status,
    statusRaw: String(item.status),
    counselorId: item.counselorId ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? null,
  };
}

/**
 * GET /api/cases?page=&size= — 관리자는 전체, 상담사는 본인에게 배정된 사례만 받는다.
 * 응답은 배열이 아니라 { items, page, size, totalElements, totalPages } 이다.
 * (page는 0부터, size는 1~50)
 */
export async function fetchCases(page = 0, size = 20): Promise<CasePage> {
  const data = await apiFetch<ApiCasePage>('/api/cases', { query: { page, size } });
  if (import.meta.env.DEV) console.debug('[api] GET /api/cases', data);
  return {
    items: data.items.map(toCaseRow),
    page: data.page,
    size: data.size,
    totalElements: data.totalElements,
    totalPages: data.totalPages,
  };
}

/**
 * GET /api/cases/{id} — 관리자는 모든 사례, 상담사는 본인에게 배정된 사례만 볼 수 있다.
 * 없는 사례와 남의 사례는 둘 다 404로 온다(존재 여부를 숨기기 위해).
 */
export async function fetchCase(id: number): Promise<CaseRow> {
  const data = await apiFetch<ApiCase>(`/api/cases/${id}`);
  if (import.meta.env.DEV) console.debug(`[api] GET /api/cases/${id}`, data);
  return toCaseRow(data);
}

/** 사례 생성·배정 응답(ApiCase)을 화면용으로 바꾼다. */
export { toCaseRow as caseFromApi };
