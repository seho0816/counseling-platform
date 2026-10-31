import { COUNSELORS } from '../mocks/counselors';
import { commit, getDb, nextId } from '../mocks/db';
import type { AgeGroup, IntakeAnswers, User } from '../types';
import { sleep } from './delay';

export interface IntakeSubmitResult {
  intakeId: string;
  caseId: string;
  counselorName: string;
}

/**
 * 챗봇 초기 질문지 제출 (F-04-3). 질문지를 저장하고 '접수' 상태의 사례를 만든다.
 * 고른 상담 분야를 주로 다루는 상담사에게 배정하고, 맞는 사람이 없으면 첫 번째 상담사에게 배정한다.
 */
export async function submitIntake(
  user: User,
  answers: IntakeAnswers,
  crisisFlag: boolean,
): Promise<IntakeSubmitResult> {
  await sleep(500);
  const db = getDb();
  const activeIds = new Set(db.accounts.filter((a) => a.role === 'counselor' && a.active).map((a) => a.id));
  const candidates = COUNSELORS.filter((c) => activeIds.has(c.id));
  const matched = candidates.find((c) => (c.fields as string[]).includes(answers.field)) ?? candidates[0];
  if (!matched) throw new Error('지금 접수를 받을 수 있는 상담사가 없어요. 잠시 후 다시 시도해 주세요.');

  const caseId = nextId('case');
  const intakeId = nextId('intake');
  const alias = user.name.endsWith('(가명)') ? user.name : `${user.name}(가명)`;
  const now = new Date().toISOString();

  db.intakes.push({ id: intakeId, alias, answers, crisisFlag, submittedAt: now, caseId });
  db.cases.push({
    id: caseId,
    clientAlias: alias,
    ageGroup: (answers.ageGroup as AgeGroup) || '20대',
    concern: answers.field,
    status: '접수',
    counselorId: matched.id,
    crisisFlag,
    source: '챗봇 접수',
    createdAt: now,
    intakeId,
  });
  commit();
  return { intakeId, caseId, counselorName: matched.name };
}
