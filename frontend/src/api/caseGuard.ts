import { getDb } from '../mocks/db';
import type { AccessAction, StoredCase, User } from '../types';
import { logAccess } from './accessLog';

export class ForbiddenError extends Error {
  constructor(message = '이 사례를 열 수 없어요. 내가 담당하는 사례만 볼 수 있어요.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * 사례 접근 보호 프록시 (F-05-2, Proxy 패턴).
 * 모든 사례·기록·요약 접근은 이 함수를 지나며, 담당 상담사가 아니면 막고 차단 기록을 남긴다.
 * 존재하지 않는 사례와 담당이 아닌 사례를 같은 응답으로 돌려, 사례 존재 여부가 새지 않게 한다.
 */
export function guardCase(user: User, caseId: string, action?: AccessAction): StoredCase {
  const found = getDb().cases.find((c) => c.id === caseId);
  if (!found || user.role !== 'counselor' || found.counselorId !== user.id) {
    logAccess(user, '접근 차단', caseId, false);
    throw new ForbiddenError();
  }
  if (action) logAccess(user, action, `${found.clientAlias} (${found.id})`);
  return found;
}
