import type { ApiAccessLogPage } from '../types';
import { apiFetch } from './http';

/** GET /api/admin/logs?page=&size= — 관리자 전용. 최신순이다(size는 1~50). */
export async function fetchAccessLogs(page = 0, size = 20): Promise<ApiAccessLogPage> {
  return apiFetch<ApiAccessLogPage>('/api/admin/logs', { query: { page, size } });
}
