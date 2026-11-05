import type { ApiMe, User } from '../types';
import { sleep } from './delay';
import { ApiError, apiFetch, clearCsrf, refreshCsrf } from './http';

/** 백엔드 역할(ADMIN, COUNSELOR) → 화면 역할 */
function toUser(me: ApiMe): User {
  const role = me.role === 'ADMIN' ? 'admin' : me.role === 'COUNSELOR' ? 'counselor' : null;
  if (!role) throw new ApiError(403, `알 수 없는 역할이에요: ${me.role}`);
  return { id: String(me.id), name: me.name, role };
}

/** GET /api/auth/me — 로그인 여부는 이 응답으로만 판단한다. 로그인되어 있지 않으면 401. */
export async function fetchMe(): Promise<User> {
  return toUser(await apiFetch<ApiMe>('/api/auth/me'));
}

/** 앱을 열 때 서버 세션이 살아 있는지 확인한다. 없으면 null. */
export async function restoreSession(): Promise<User | null> {
  try {
    return await fetchMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * 상담사·관리자 로그인 (F-05-1). 백엔드 순서를 그대로 따른다.
 * 1) GET /api/auth/csrf  2) POST /api/auth/login(form)  3) GET /api/auth/csrf(갱신)  4) GET /api/auth/me
 */
export async function loginWithPassword(email: string, password: string): Promise<User> {
  await refreshCsrf();
  try {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      form: { username: email.trim().toLowerCase(), password },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new Error('이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
    }
    throw error;
  }
  await refreshCsrf(); // 로그인 후에는 토큰이 바뀌므로 반드시 다시 받는다.
  return fetchMe();
}

/** POST /api/auth/logout. 서버 세션이 이미 없어도 화면에서는 로그아웃으로 처리한다. */
export async function logoutFromServer(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* 세션이 이미 끝났거나 서버가 꺼져 있어도 로컬 로그아웃은 계속한다 */
  } finally {
    clearCsrf();
  }
}

/** 내담자는 백엔드 로그인이 없다. 지금은 화면 안에서만 쓰는 가상 입장이다. (F-05-1) */
export async function enterAsClient(alias: string): Promise<User> {
  await sleep(200);
  return { id: `client-${Date.now()}`, name: alias.trim() || '방문자', role: 'client' };
}
