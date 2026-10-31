import { commit, getDb, nextId } from '../mocks/db';
import type { AccessAction, AccessLog, User } from '../types';
import { sleep } from './delay';

export class AdminOnlyError extends Error {
  constructor() {
    super('기관 관리자만 볼 수 있는 정보예요.');
    this.name = 'AdminOnlyError';
  }
}

function assertAdmin(user: User) {
  if (user.role !== 'admin') throw new AdminOnlyError();
}

export interface LogFilter {
  userId: string | 'all';
  action: AccessAction | 'all';
  blockedOnly: boolean;
}

/** 접근 로그 조회 (F-05-3). 관리자만 볼 수 있다. */
export async function listLogs(user: User, filter: LogFilter): Promise<AccessLog[]> {
  await sleep(250);
  assertAdmin(user);
  return getDb()
    .logs.filter(
      (l) =>
        (filter.userId === 'all' || l.userId === filter.userId) &&
        (filter.action === 'all' || l.action === filter.action) &&
        (!filter.blockedOnly || !l.allowed),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: 'counselor' | 'admin';
  active: boolean;
  /** 담당 사례 건수만 보여준다. 관리자는 사례 내용을 볼 수 없다. */
  caseCount: number;
}

/** 계정 목록 (F-05-1). */
export async function listAccounts(user: User): Promise<AccountRow[]> {
  await sleep(250);
  assertAdmin(user);
  const db = getDb();
  return db.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    active: a.active,
    caseCount: db.cases.filter((c) => c.counselorId === a.id).length,
  }));
}

export async function setAccountActive(user: User, accountId: string, active: boolean): Promise<void> {
  await sleep(250);
  assertAdmin(user);
  const account = getDb().accounts.find((a) => a.id === accountId);
  if (!account) throw new Error('계정을 찾을 수 없어요.');
  if (account.role === 'admin') throw new Error('관리자 계정은 중지할 수 없어요.');
  account.active = active;
  commit();
}

export interface NewAccountInput {
  name: string;
  email: string;
}

/** 상담사 계정 추가. 개발용 기본 비밀번호는 'counselor1234'이다. */
export async function createCounselorAccount(user: User, input: NewAccountInput): Promise<void> {
  await sleep(300);
  assertAdmin(user);
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (db.accounts.some((a) => a.email === email)) throw new Error('이미 쓰고 있는 이메일이에요.');
  db.accounts.push({
    id: nextId('c'),
    name: input.name.trim(),
    email,
    password: 'counselor1234',
    role: 'counselor',
    active: true,
  });
  commit();
}
