import { stateOf, toStatus } from '../domain/caseState';
import { commit, getDb, nextId } from '../mocks/db';
import type {
  AgeGroup,
  CaseStatus,
  CounselingCase,
  IntakeForm,
  Session,
  SessionMethod,
  SessionRow,
  StoredCase,
  SummaryState,
  User,
} from '../types';
import { logAccess } from './accessLog';
import { guardCase } from './caseGuard';
import { sleep } from './delay';

/** 저장된 사례에 회기·요약에서 계산한 값(회기 수, 최근 상담, 요약 상태)을 더한다. */
function toView(c: StoredCase): CounselingCase {
  const db = getDb();
  const sessions = db.sessions.filter((s) => s.caseId === c.id);
  const summaryOf = (sessionId: string) => db.summaries.find((s) => s.sessionId === sessionId);

  let summaryState: SummaryState = 'none';
  if (sessions.length > 0) {
    const statuses = sessions.map((s) => summaryOf(s.id)?.status ?? 'none');
    if (statuses.includes('draft')) summaryState = 'draft';
    else if (statuses.includes('none')) summaryState = 'missing';
    else summaryState = 'confirmed';
  }

  const dates = sessions.map((s) => s.heldAt).sort();
  const last = dates.length > 0 ? dates[dates.length - 1] : null;
  return { ...c, sessionCount: sessions.length, lastSessionAt: last, summaryState };
}

/** 담당 사례 목록 (F-03). 상담사는 자신의 담당 사례만 받는다. */
export async function listCases(user: User): Promise<CounselingCase[]> {
  await sleep(250);
  return getDb()
    .cases.filter((c) => c.counselorId === user.id)
    .map(toView)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 사례 한 건 조회. 담당이 아니면 ForbiddenError. */
export async function getCase(user: User, caseId: string): Promise<CounselingCase> {
  await sleep(200);
  return toView(guardCase(user, caseId, '조회'));
}

export interface NewCaseInput {
  alias: string;
  ageGroup: AgeGroup;
  concern: string;
}

/** 사례 등록 (F-01-1). 상태는 '접수'로 시작한다. */
export async function createCase(user: User, input: NewCaseInput): Promise<CounselingCase> {
  await sleep(300);
  const db = getDb();
  const alias = input.alias.trim();
  const stored: StoredCase = {
    id: nextId('case'),
    clientAlias: alias.endsWith('(가명)') ? alias : `${alias}(가명)`,
    ageGroup: input.ageGroup,
    concern: input.concern,
    status: '접수',
    counselorId: user.id,
    crisisFlag: false,
    source: '상담사 등록',
    createdAt: new Date().toISOString(),
    intakeId: null,
  };
  db.cases.push(stored);
  commit();
  logAccess(user, '등록', `${stored.clientAlias} (${stored.id})`);
  return toView(stored);
}

/** 사례 상태 변경 (F-03-2). 허용된 전이만 가능하다. */
export async function changeStatus(user: User, caseId: string, next: CaseStatus): Promise<CounselingCase> {
  await sleep(250);
  const c = guardCase(user, caseId);
  const state = stateOf(c.status);
  if (!state.nextStatuses().includes(next)) {
    throw new Error(`${c.status} 상태에서는 ${toStatus(next)} 바꿀 수 없어요.`);
  }
  const before = c.status;
  c.status = next;
  commit();
  logAccess(user, '상태 변경', `${c.clientAlias} (${c.id}) ${before}→${next}`);
  return toView(c);
}

/** 회기 목록 (F-03-1). 최근 회기가 먼저 온다. */
export async function listSessions(user: User, caseId: string): Promise<SessionRow[]> {
  await sleep(200);
  guardCase(user, caseId);
  const db = getDb();
  return db.sessions
    .filter((s) => s.caseId === caseId)
    .sort((a, b) => b.number - a.number)
    .map((s) => ({ ...s, summaryStatus: db.summaries.find((x) => x.sessionId === s.id)?.status ?? 'none' }));
}

export interface NewSessionInput {
  heldAt: string;
  method: SessionMethod;
  record: string;
}

/** 회기 추가와 상담 기록 저장 (F-01-2). 진행 상태의 사례에만 추가할 수 있다. */
export async function createSession(user: User, caseId: string, input: NewSessionInput): Promise<Session> {
  await sleep(300);
  const c = guardCase(user, caseId);
  const state = stateOf(c.status);
  if (!state.canAddSession()) {
    throw new Error(state.sessionBlockedReason() ?? '이 사례에는 회기를 추가할 수 없어요.');
  }
  const db = getDb();
  const number = db.sessions.filter((s) => s.caseId === caseId).reduce((max, s) => Math.max(max, s.number), 0) + 1;
  const session: Session = {
    id: `${caseId}-s${number}`,
    caseId,
    number,
    heldAt: new Date(input.heldAt).toISOString(),
    method: input.method,
    record: input.record.trim(),
  };
  db.sessions.push(session);
  commit();
  logAccess(user, '작성', `${c.clientAlias} (${c.id}) ${number}회기 기록`);
  return session;
}

/** 확정된 요약이 있는 회기의 기록은 고칠 수 없다. */
export async function updateRecord(user: User, caseId: string, sessionId: string, record: string): Promise<Session> {
  await sleep(250);
  const c = guardCase(user, caseId);
  const db = getDb();
  const session = db.sessions.find((s) => s.id === sessionId && s.caseId === caseId);
  if (!session) throw new Error('회기를 찾을 수 없어요.');
  const summary = db.summaries.find((s) => s.sessionId === sessionId);
  if (summary?.status === 'confirmed') throw new Error('요약을 확정한 회기의 기록은 고칠 수 없어요.');
  session.record = record.trim();
  commit();
  logAccess(user, '수정', `${c.clientAlias} (${c.id}) ${session.number}회기 기록`);
  return session;
}

/** 챗봇 접수로 만들어진 사례의 접수 질문지 (F-04-3). */
export async function getIntake(user: User, caseId: string): Promise<IntakeForm | null> {
  await sleep(150);
  const c = guardCase(user, caseId);
  return getDb().intakes.find((i) => i.id === c.intakeId) ?? null;
}
