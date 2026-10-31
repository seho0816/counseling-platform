import { commit, getDb, nextId } from '../mocks/db';
import type { AccessAction, User } from '../types';

/** 같은 사용자의 같은 동작이 2초 안에 반복되면 한 번만 기록한다(화면이 같은 데이터를 두 번 불러오는 경우). */
const DEDUPE_MS = 2000;

/** 접근 로그 기록 (F-05-3). 실제 서비스에서는 백엔드가 모든 요청에서 남긴다. */
export function logAccess(user: User, action: AccessAction, target: string, allowed = true) {
  const db = getDb();
  const now = Date.now();
  const last = db.logs.find((l) => l.userId === user.id && l.action === action && l.target === target);
  if (last && now - new Date(last.at).getTime() < DEDUPE_MS) return;

  db.logs.unshift({
    id: nextId('log'),
    userId: user.id,
    userName: user.name,
    role: user.role,
    action,
    target,
    allowed,
    at: new Date(now).toISOString(),
  });
  commit();
}
