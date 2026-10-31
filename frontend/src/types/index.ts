import type { AgeGroup, CounselingField } from '../constants/fields';

export type { AgeGroup, CounselingField };

export type Role = 'counselor' | 'admin' | 'client';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type ConsultMethod = 'chat' | 'voice';

/** 상담사의 주간 반복 가능 시간. weekday: 0(일)~6(토), time: 'HH:mm' */
export interface WeeklySlot {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: string;
}

/** 안내서 주요 데이터 Counselor (공개 프로필 부분) */
export interface Counselor {
  id: string;
  name: string;
  title: string;
  organization: string;
  fields: CounselingField[];
  intro: string;
  methods: ConsultMethod[];
  availability: WeeklySlot[];
}

export type CaseStatus = '접수' | '진행' | '종결' | '연계';
export type CaseSource = '상담사 등록' | '챗봇 접수';

/** none: 회기 없음 / missing: 요약 없는 회기가 있음 / draft: 검토할 초안이 있음 / confirmed: 모두 확정 */
export type SummaryState = 'none' | 'missing' | 'draft' | 'confirmed';

/** 저장되는 사례 (안내서 주요 데이터 Case) */
export interface StoredCase {
  id: string;
  clientAlias: string;
  ageGroup: AgeGroup;
  concern: string;
  status: CaseStatus;
  counselorId: string;
  crisisFlag: boolean;
  source: CaseSource;
  createdAt: string;
  intakeId: string | null;
}

/** 화면에서 쓰는 사례: 저장값에 회기·요약에서 계산한 값을 더한 것 */
export interface CounselingCase extends StoredCase {
  sessionCount: number;
  lastSessionAt: string | null;
  summaryState: SummaryState;
}

export type SessionMethod = 'chat' | 'voice' | 'other';

/** 안내서 주요 데이터 Session */
export interface Session {
  id: string;
  caseId: string;
  number: number;
  heldAt: string;
  method: SessionMethod;
  record: string;
}

export type SummaryStatus = 'draft' | 'confirmed';

export interface SummaryFields {
  complaint: string;
  intervention: string;
  nextPlan: string;
}

export type SummaryKey = keyof SummaryFields;
export type EvidenceMap = Record<SummaryKey, string[]>;

/** 안내서 주요 데이터 SessionSummary */
export interface SessionSummary {
  id: string;
  sessionId: string;
  status: SummaryStatus;
  source: 'ai' | 'manual';
  fields: SummaryFields;
  /** AI가 처음 만든 초안. 상담자가 얼마나 고쳤는지 비교하는 데 쓴다. */
  aiDraft: SummaryFields | null;
  evidence: EvidenceMap | null;
  maskedCount: number;
  generatedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

/** 회기 목록용: 회기 + 요약 상태 */
export interface SessionRow extends Session {
  summaryStatus: SummaryStatus | 'none';
}

export interface IntakeAnswers {
  field: string;
  ageGroup: string;
  method: string;
  time: string;
  concern: string;
}

/** 안내서 주요 데이터 IntakeForm */
export interface IntakeForm {
  id: string;
  alias: string;
  answers: IntakeAnswers;
  crisisFlag: boolean;
  submittedAt: string;
  caseId: string;
}

export type AccessAction = '조회' | '등록' | '작성' | '수정' | '확정' | '상태 변경' | '접근 차단';

/** 안내서 주요 데이터 AccessLog */
export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  action: AccessAction;
  target: string;
  allowed: boolean;
  at: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'counselor' | 'admin';
  active: boolean;
}
