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

/* ---------------------------------------------------------------------- */
/* Spring Boot API 응답 형태 (Mock 타입과 다르다. 화면에 쓰기 전에 변환한다.) */
/* ---------------------------------------------------------------------- */

/** 백엔드의 사례 상태(영어 Enum) */
export type CaseStatusCode = 'RECEIVED' | 'IN_PROGRESS' | 'CLOSED' | 'REFERRED';

/** GET /api/cases 의 items 한 건 */
export interface ApiCase {
  id: number;
  clientId: number;
  /** 아직 응답에 없을 수 있다(구버전 백엔드) */
  clientAlias?: string | null;
  ageGroup?: string | null;
  counselorId: number | null;
  title: string;
  concern?: string | null;
  status: CaseStatusCode | string;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/cases 의 응답. 배열이 아니라 items 안에 사례가 들어 있다. */
export interface ApiCasePage {
  items: ApiCase[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** GET /api/auth/me */
export interface ApiMe {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'COUNSELOR' | string;
}

/** 화면 표시용으로 변환한 사례 */
export interface CaseRow {
  id: number;
  clientId: number;
  /** 가명. 응답에 없으면 '내담자 #번호' */
  alias: string;
  ageGroup: string | null;
  concern: string | null;
  title: string;
  /** 한글 상태. 알 수 없는 값이면 null이고 statusRaw를 보여준다. */
  status: CaseStatus | null;
  statusRaw: string;
  counselorId: number | null;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/admin/counselors 의 한 건 (비밀번호·해시는 응답에 없다) */
export interface ApiCounselorAccount {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

/** POST /api/admin/clients 의 응답 */
export interface ApiClient {
  id: number;
  name: string;
  contact: string | null;
  createdAt: string;
}
