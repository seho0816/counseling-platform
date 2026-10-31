import { generateSummaryDraft, sameText } from '../domain/summarizer';
import { commit, getDb, nextId } from '../mocks/db';
import type { Session, SessionSummary, SummaryFields, User } from '../types';
import { logAccess } from './accessLog';
import { guardCase } from './caseGuard';
import { sleep } from './delay';

/** 개발용: 'mindnote.sim.aiFail'이 '1'이면 AI 호출 실패를 흉내 낸다. (NFR-09 확인용) */
const SIM_FAIL_KEY = 'mindnote.sim.aiFail';

function findSession(caseId: string, sessionId: string): Session {
  const session = getDb().sessions.find((s) => s.id === sessionId && s.caseId === caseId);
  if (!session) throw new Error('회기를 찾을 수 없어요.');
  return session;
}

function findSummary(sessionId: string): SessionSummary | undefined {
  return getDb().summaries.find((s) => s.sessionId === sessionId);
}

export interface SessionDetail {
  session: Session;
  summary: SessionSummary | null;
}

/** 회기 한 건과 요약 조회. */
export async function getSessionDetail(user: User, caseId: string, sessionId: string): Promise<SessionDetail> {
  await sleep(200);
  guardCase(user, caseId, '조회');
  const session = findSession(caseId, sessionId);
  return { session, summary: findSummary(sessionId) ?? null };
}

/** AI 요약 초안 생성 (F-02-1). 확정된 요약이 있으면 만들 수 없다. */
export async function generateSummary(user: User, caseId: string, sessionId: string): Promise<SessionSummary> {
  const c = guardCase(user, caseId);
  const session = findSession(caseId, sessionId);
  const existing = findSummary(sessionId);
  if (existing?.status === 'confirmed') throw new Error('이미 확정한 요약이에요.');

  await sleep(1800); // 외부 AI 호출 시간을 흉내 낸다
  if (localStorage.getItem(SIM_FAIL_KEY) === '1') {
    throw new Error('AI 요약을 만들지 못했어요. 잠시 후 다시 시도하거나 직접 작성해 주세요.');
  }
  if (session.record.trim().length < 20) throw new Error('상담 기록이 너무 짧아요. 기록을 더 쓴 뒤 요약해 주세요.');

  const draft = generateSummaryDraft(session.record);
  const summary: SessionSummary = {
    id: existing?.id ?? nextId('sum'),
    sessionId,
    status: 'draft',
    source: 'ai',
    fields: draft.fields,
    aiDraft: draft.fields,
    evidence: draft.evidence,
    maskedCount: draft.maskedCount,
    generatedAt: new Date().toISOString(),
    confirmedAt: null,
    confirmedBy: null,
  };
  upsert(summary);
  logAccess(user, '작성', `${c.clientAlias} (${c.id}) ${session.number}회기 요약 초안`);
  return summary;
}

/** AI를 쓰지 못할 때 직접 작성하는 길 (NFR-09). */
export async function createManualDraft(user: User, caseId: string, sessionId: string): Promise<SessionSummary> {
  await sleep(150);
  const c = guardCase(user, caseId);
  const session = findSession(caseId, sessionId);
  const existing = findSummary(sessionId);
  if (existing?.status === 'confirmed') throw new Error('이미 확정한 요약이에요.');
  const summary: SessionSummary = {
    id: existing?.id ?? nextId('sum'),
    sessionId,
    status: 'draft',
    source: 'manual',
    fields: { complaint: '', intervention: '', nextPlan: '' },
    aiDraft: null,
    evidence: null,
    maskedCount: 0,
    generatedAt: new Date().toISOString(),
    confirmedAt: null,
    confirmedBy: null,
  };
  upsert(summary);
  logAccess(user, '작성', `${c.clientAlias} (${c.id}) ${session.number}회기 요약(직접 작성)`);
  return summary;
}

/** 요약 초안 임시 저장. */
export async function saveDraft(
  user: User,
  caseId: string,
  sessionId: string,
  fields: SummaryFields,
): Promise<SessionSummary> {
  await sleep(200);
  const c = guardCase(user, caseId);
  const summary = findSummary(sessionId);
  if (!summary) throw new Error('요약 초안이 없어요.');
  if (summary.status === 'confirmed') throw new Error('확정한 요약은 고칠 수 없어요.');
  summary.fields = fields;
  commit();
  logAccess(user, '수정', `${c.clientAlias} (${c.id}) ${findSession(caseId, sessionId).number}회기 요약 초안`);
  return summary;
}

/** 요약 확정 저장 (F-02-2). 세 항목이 모두 채워져 있어야 하고, 확정 전에는 정식 기록이 아니다. */
export async function confirmSummary(
  user: User,
  caseId: string,
  sessionId: string,
  fields: SummaryFields,
): Promise<SessionSummary> {
  await sleep(300);
  const c = guardCase(user, caseId);
  const summary = findSummary(sessionId);
  if (!summary) throw new Error('요약 초안이 없어요.');
  if (summary.status === 'confirmed') throw new Error('이미 확정한 요약이에요.');
  const empty = (Object.entries(fields) as Array<[keyof SummaryFields, string]>).filter(([, v]) => v.trim() === '');
  if (empty.length > 0) throw new Error('세 항목을 모두 채운 뒤 확정해 주세요.');

  summary.fields = fields;
  summary.status = 'confirmed';
  summary.confirmedAt = new Date().toISOString();
  summary.confirmedBy = user.name;
  commit();
  logAccess(user, '확정', `${c.clientAlias} (${c.id}) ${findSession(caseId, sessionId).number}회기 요약`);
  return summary;
}

/** 확정 요약에서 항목별로 AI 초안과 달라졌는지 */
export function editedFlags(summary: SessionSummary): Record<keyof SummaryFields, boolean> {
  const draft = summary.aiDraft;
  return {
    complaint: draft ? !sameText(draft.complaint, summary.fields.complaint) : false,
    intervention: draft ? !sameText(draft.intervention, summary.fields.intervention) : false,
    nextPlan: draft ? !sameText(draft.nextPlan, summary.fields.nextPlan) : false,
  };
}

function upsert(summary: SessionSummary) {
  const db = getDb();
  const index = db.summaries.findIndex((s) => s.sessionId === summary.sessionId);
  if (index >= 0) db.summaries[index] = summary;
  else db.summaries.push(summary);
  commit();
}
