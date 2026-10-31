import type { Account } from '../types';
import { COUNSELORS } from './counselors';

/** 개발용 계정(가상). 실제 인증은 백엔드 연동 시 대체한다. 비밀번호는 평문이므로 Mock에서만 쓴다. */
export const DEV_PASSWORDS = { counselor: 'counselor1234', admin: 'admin1234' } as const;

export function buildSeedAccounts(): Account[] {
  const counselors: Account[] = COUNSELORS.map((c, index) => ({
    id: c.id,
    name: c.name,
    email: index === 0 ? 'counselor@mindnote.test' : `counselor${index + 1}@mindnote.test`,
    password: DEV_PASSWORDS.counselor,
    role: 'counselor',
    active: true,
  }));
  const admin: Account = {
    id: 'a-01',
    name: '기관 관리자',
    email: 'admin@mindnote.test',
    password: DEV_PASSWORDS.admin,
    role: 'admin',
    active: true,
  };
  return [...counselors, admin];
}
