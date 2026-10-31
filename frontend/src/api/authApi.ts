import { getDb } from '../mocks/db';
import type { User } from '../types';
import { sleep } from './delay';

/** 상담사·관리자 로그인 (F-05-1). 백엔드 연동 시 POST /auth/login 으로 교체. */
export async function loginWithPassword(
  email: string,
  password: string,
  role: 'counselor' | 'admin',
): Promise<User> {
  await sleep(350);
  const account = getDb().accounts.find(
    (a) => a.email === email.trim().toLowerCase() && a.password === password && a.role === role,
  );
  if (!account) {
    throw new Error('이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
  }
  if (!account.active) {
    throw new Error('사용이 중지된 계정이에요. 기관 관리자에게 문의해 주세요.');
  }
  return { id: account.id, name: account.name, role: account.role };
}

/** 내담자는 비밀번호 없이 신청 링크로 입장한다 (F-05-1). 입력한 이름은 가명으로만 쓴다. */
export async function enterAsClient(alias: string): Promise<User> {
  await sleep(200);
  return { id: `client-${Date.now()}`, name: alias.trim() || '방문자', role: 'client' };
}
