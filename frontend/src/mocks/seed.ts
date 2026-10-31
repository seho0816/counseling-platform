import { generateSummaryDraft } from '../domain/summarizer';
import type {
  AccessAction,
  AccessLog,
  AgeGroup,
  CaseSource,
  CaseStatus,
  IntakeForm,
  Role,
  Session,
  SessionSummary,
  StoredCase,
} from '../types';
import type { Db } from './db';
import { buildSeedAccounts } from './users';

const DAY = 86_400_000;

/** 가상 상담 기록 샘플. 실제 상담과 무관하다. */
const RECORDS = {
  anxiety:
    '내담자는 최근 한 달간 잠을 설치고 사소한 일에도 불안이 커진다고 호소했다. 직장에서 업무량이 늘면서 스트레스가 심해졌고 퇴근 후에도 걱정이 멈추지 않는다고 말했다. 오늘은 호흡 이완 연습을 함께 해 보고 불안이 올라오는 상황을 기록하는 방법을 안내했다. 내담자는 연습 후 몸이 조금 가벼워졌다고 답했다. 다음 회기까지 하루 한 번 불안 일지를 작성해 오기로 했다. 다음 시간에는 일지를 바탕으로 불안이 커지는 패턴을 함께 점검할 예정이다.',
  relation:
    '내담자는 친구와 다툰 뒤 모임에 나가기가 두렵다고 이야기했다. 거절당할까 봐 먼저 연락하지 못해 외롭고 답답하다고 했다. 상담자는 상황을 순서대로 정리하도록 돕고 감정과 사실을 나눠서 살펴보게 했다. 내담자가 원하는 관계의 모습을 함께 탐색했고 가벼운 안부 메시지를 보내 보는 시도를 제안했다. 다음 회기 전까지 안부 메시지를 한 번 보내 보는 과제를 정했다. 다음 시간에 결과를 나누고 대화 연습을 이어갈 계획이다.',
  family:
    '내담자는 가족과의 대화가 자주 말다툼으로 끝나서 집에 있는 시간이 힘들다고 호소했다. 부모님의 기대가 부담스럽고 의견을 말하면 무시당하는 느낌이 든다고 했다. 상담자는 최근 갈등 상황을 하나 골라 상황과 감정을 정리하게 했다. 말하기 전에 원하는 것을 한 문장으로 정리하는 방법을 설명하고 연습했다. 다음 회기까지 정리한 문장을 가족에게 한 번 전해 보기로 했다. 다음 시간에 전한 결과를 점검하고 대화 방식을 조정할 예정이다.',
  career:
    '내담자는 진로를 정하지 못해 마음이 급하고 무기력하다고 고민을 털어놓았다. 주변과 비교하면 자신이 뒤처진다는 생각이 자주 든다고 말했다. 상담자는 지금까지 흥미를 느꼈던 경험을 함께 나열하며 공통점을 탐색했다. 관심 분야 직업 정보를 확인하는 방법을 안내하고 작은 탐색 활동을 제안했다. 다음 회기까지 관심 분야 두 곳을 조사해 오기로 했다. 다음 시간에 조사 내용을 바탕으로 선택지를 정리할 계획이다.',
  welfare:
    '내담자는 생활비 부담으로 걱정이 많고 어디에 도움을 청해야 할지 막막하다고 말했다. 최근 일자리가 줄면서 잠을 못 이루는 날이 늘었다고 했다. 상담자는 받을 수 있는 지원 제도를 설명하고 필요한 서류를 함께 확인했다. 지역 복지 담당 기관에 연결할 수 있도록 신청 절차를 안내했다. 연락은 010-1234-5678로 하기로 했다. 다음 회기 전까지 서류를 준비해 보기로 했다. 다음 시간에 신청 진행 상황을 점검할 예정이다.',
} as const;

const RECORD_BY_CONCERN: Record<string, keyof typeof RECORDS> = {
  '우울·불안': 'anxiety',
  '직장·스트레스': 'anxiety',
  대인관계: 'relation',
  '가족·부부': 'family',
  '진로·학업': 'career',
  청소년: 'career',
  '노인·돌봄': 'welfare',
  '경제·복지 연계': 'welfare',
};

interface SeedCase {
  id: string;
  alias: string;
  age: AgeGroup;
  concern: string;
  status: CaseStatus;
  counselorId: string;
  sessions: number;
  lastDaysAgo: number | null;
  draftLatest?: boolean;
  crisis?: boolean;
  source?: CaseSource;
}

const SEED_CASES: SeedCase[] = [
  { id: 'case-001', alias: '하늘', age: '20대', concern: '우울·불안', status: '진행', counselorId: 'c-01', sessions: 4, lastDaysAgo: 2, draftLatest: true },
  { id: 'case-002', alias: '이든', age: '30대', concern: '직장·스트레스', status: '진행', counselorId: 'c-01', sessions: 6, lastDaysAgo: 5 },
  { id: 'case-003', alias: '나래', age: '10대', concern: '청소년', status: '접수', counselorId: 'c-01', sessions: 0, lastDaysAgo: null, crisis: true, source: '챗봇 접수' },
  { id: 'case-004', alias: '도윤', age: '40대', concern: '대인관계', status: '진행', counselorId: 'c-01', sessions: 3, lastDaysAgo: 1, draftLatest: true },
  { id: 'case-005', alias: '서아', age: '20대', concern: '진로·학업', status: '종결', counselorId: 'c-01', sessions: 8, lastDaysAgo: 21 },
  { id: 'case-006', alias: '지후', age: '30대', concern: '가족·부부', status: '진행', counselorId: 'c-01', sessions: 2, lastDaysAgo: 9, draftLatest: true },
  { id: 'case-007', alias: '유나', age: '20대', concern: '우울·불안', status: '접수', counselorId: 'c-01', sessions: 0, lastDaysAgo: null, source: '챗봇 접수' },
  { id: 'case-008', alias: '민서', age: '50대', concern: '경제·복지 연계', status: '연계', counselorId: 'c-01', sessions: 5, lastDaysAgo: 14 },
  { id: 'case-009', alias: '시우', age: '30대', concern: '대인관계', status: '진행', counselorId: 'c-01', sessions: 5, lastDaysAgo: 3 },
  { id: 'case-010', alias: '다은', age: '60대 이상', concern: '노인·돌봄', status: '종결', counselorId: 'c-01', sessions: 10, lastDaysAgo: 30 },
  { id: 'case-011', alias: '은우', age: '10대', concern: '청소년', status: '진행', counselorId: 'c-02', sessions: 2, lastDaysAgo: 4, draftLatest: true },
  { id: 'case-012', alias: '하린', age: '10대', concern: '진로·학업', status: '접수', counselorId: 'c-02', sessions: 0, lastDaysAgo: null, source: '챗봇 접수' },
  { id: 'case-013', alias: '준서', age: '40대', concern: '가족·부부', status: '진행', counselorId: 'c-03', sessions: 3, lastDaysAgo: 6 },
  { id: 'case-014', alias: '소율', age: '30대', concern: '대인관계', status: '진행', counselorId: 'c-03', sessions: 1, lastDaysAgo: 2, draftLatest: true },
];

const INTAKE_CONCERN: Record<string, string> = {
  'case-003': '요즘 너무 지쳐서 아무 의욕이 없어요. 사라지고 싶다는 생각이 들어요.',
  'case-007': '잠을 잘 못 자고 자꾸 불안해요.',
  'case-012': '진로 때문에 부모님과 자주 다퉈서 고민이에요.',
};

type LogSeed = [daysAgo: number, hour: number, userId: string, action: AccessAction, target: string, allowed?: boolean];

const SEED_LOGS: LogSeed[] = [
  [6, 9, 'c-01', '조회', '하늘(가명) (case-001)'],
  [6, 10, 'c-01', '작성', '하늘(가명) (case-001) 4회기 기록'],
  [5, 11, 'c-01', '확정', '이든(가명) (case-002) 요약'],
  [5, 14, 'c-02', '조회', '은우(가명) (case-011)'],
  [4, 9, 'c-02', '작성', '은우(가명) (case-011) 2회기 기록'],
  [4, 15, 'c-02', '접근 차단', 'case-001', false],
  [3, 10, 'c-03', '조회', '준서(가명) (case-013)'],
  [3, 13, 'c-01', '상태 변경', '민서(가명) (case-008) 진행→연계'],
  [3, 16, 'c-01', '수정', '시우(가명) (case-009) 요약'],
  [2, 9, 'c-03', '확정', '소율(가명) (case-014) 요약'],
  [2, 11, 'c-01', '조회', '도윤(가명) (case-004)'],
  [2, 14, 'c-03', '접근 차단', 'case-002', false],
  [1, 9, 'c-01', '작성', '도윤(가명) (case-004) 3회기 기록'],
  [1, 10, 'c-01', '확정', '지후(가명) (case-006) 1회기 요약'],
  [1, 15, 'c-02', '등록', '하린(가명) (case-012) 챗봇 접수'],
  [0, 9, 'c-01', '조회', '나래(가명) (case-003)'],
];

export function buildSeed(now: Date = new Date()): Db {
  const at = (daysAgo: number, hour = 14) => {
    const d = new Date(now.getTime() - daysAgo * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const accounts = buildSeedAccounts();
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const roleOf = (id: string): Role => accounts.find((a) => a.id === id)?.role ?? 'counselor';

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${String((seq += 1)).padStart(4, '0')}`;

  const cases: StoredCase[] = [];
  const sessions: Session[] = [];
  const summaries: SessionSummary[] = [];
  const intakes: IntakeForm[] = [];

  SEED_CASES.forEach((seed) => {
    const lastAgo = seed.lastDaysAgo ?? 0;
    const firstAgo = lastAgo + Math.max(seed.sessions - 1, 0) * 7 + 14;
    let intakeId: string | null = null;

    if (seed.source === '챗봇 접수') {
      intakeId = nextId('intake');
      const method = seed.age === '10대' ? '실시간 채팅' : '음성 메시지';
      intakes.push({
        id: intakeId,
        alias: `${seed.alias}(가명)`,
        answers: {
          field: seed.concern,
          ageGroup: seed.age,
          method,
          time: '평일 저녁',
          concern: INTAKE_CONCERN[seed.id] ?? '',
        },
        crisisFlag: Boolean(seed.crisis),
        submittedAt: at(firstAgo - 1, 20),
        caseId: seed.id,
      });
    }

    cases.push({
      id: seed.id,
      clientAlias: `${seed.alias}(가명)`,
      ageGroup: seed.age,
      concern: seed.concern,
      status: seed.status,
      counselorId: seed.counselorId,
      crisisFlag: Boolean(seed.crisis),
      source: seed.source ?? '상담사 등록',
      createdAt: at(firstAgo),
      intakeId,
    });

    for (let n = 1; n <= seed.sessions; n += 1) {
      const heldAgo = lastAgo + (seed.sessions - n) * 7;
      const base = RECORDS[RECORD_BY_CONCERN[seed.concern] ?? 'anxiety'];
      const record = n > 1 ? `${n}회기에서는 지난 시간의 과제 수행 여부를 먼저 확인했다. ${base}` : base;
      const sessionId = `${seed.id}-s${n}`;
      sessions.push({
        id: sessionId,
        caseId: seed.id,
        number: n,
        heldAt: at(heldAgo),
        method: n % 2 === 0 ? 'voice' : 'chat',
        record,
      });

      const draft = generateSummaryDraft(record);
      const isDraft = Boolean(seed.draftLatest) && n === seed.sessions;
      summaries.push({
        id: nextId('sum'),
        sessionId,
        status: isDraft ? 'draft' : 'confirmed',
        source: 'ai',
        fields: draft.fields,
        aiDraft: draft.fields,
        evidence: draft.evidence,
        maskedCount: draft.maskedCount,
        generatedAt: at(heldAgo),
        confirmedAt: isDraft ? null : at(Math.max(heldAgo - 1, 0), 9),
        confirmedBy: isDraft ? null : nameOf(seed.counselorId),
      });
    }
  });

  const logs: AccessLog[] = SEED_LOGS.map(([daysAgo, hour, userId, action, target, allowed = true]) => ({
    id: nextId('log'),
    userId,
    userName: nameOf(userId),
    role: roleOf(userId),
    action,
    target,
    allowed,
    at: at(daysAgo, hour),
  })).sort((a, b) => b.at.localeCompare(a.at));

  return { seq, accounts, cases, sessions, summaries, intakes, logs };
}
