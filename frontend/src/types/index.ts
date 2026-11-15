export type Role = 'counselor' | 'admin' | 'client';

export interface User {
  id: string;
  name: string;
  role: Role;
}

/** 화면에 보여주는 사례 상태(한글). 서버 값(RECEIVED 등)은 CaseStatusCode이다. */
export type CaseStatus = '접수' | '진행' | '종결' | '연계';

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

/* ---------------------------------------------------------------------- */
/* 회기·요약·접수·접근 로그 API 응답 형태                                    */
/* ---------------------------------------------------------------------- */

/** GET·POST·PATCH /api/cases/{caseId}/sessions 의 한 건 */
export interface ApiSession {
  id: number;
  caseId: number;
  sessionNumber: number;
  /** 'YYYY-MM-DD' (날짜만) */
  sessionDate: string;
  content: string;
  authorUserId: number;
  createdAt: string;
  updatedAt: string | null;
}

/** 요약 3항목. 값이 없으면 null이다. */
export interface ApiSummaryFields {
  complaint: string | null;
  intervention: string | null;
  nextPlan: string | null;
}

export type ApiSummaryStatus = 'DRAFT' | 'CONFIRMED';

/** GET /api/sessions/{sessionId}/summary */
export interface ApiSummary {
  id: number;
  sessionId: number;
  aiDraft: ApiSummaryFields;
  finalSummary: ApiSummaryFields | null;
  status: ApiSummaryStatus;
  modelName: string | null;
  confirmedBy: number | null;
  confirmedAt: string | null;
}

export type IntakeStatusCode = 'SUBMITTED' | 'PROCESSED';

/** 관리자용 접수 한 건 (GET /api/admin/intakes) */
export interface ApiIntake {
  id: number;
  applicantName: string;
  applicantContact: string | null;
  concernCategory: string;
  concernDescription: string;
  hasPriorCounseling: boolean | null;
  status: IntakeStatusCode | string;
  privacyConsentAt: string | null;
  createdAt: string;
}

export interface ApiIntakePage {
  items: ApiIntake[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** POST /api/intakes 의 응답(개인정보는 돌려주지 않는다) */
export interface ApiIntakeAccepted {
  id: number;
  status: IntakeStatusCode | string;
  createdAt: string;
}

/** GET /api/admin/logs 의 한 건 */
export interface ApiAccessLog {
  id: number;
  actorUserId: number | null;
  resourceType: string;
  resourceId: number | null;
  action: string;
  result: 'SUCCESS' | 'DENIED' | string;
  createdAt: string;
}

export interface ApiAccessLogPage {
  items: ApiAccessLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
