import type { CaseStatus, CaseStatusCode } from '../types';

/** 백엔드 상태 값(영어) → 화면 표시(한글) */
export const CASE_STATUS_LABEL: Record<CaseStatusCode, CaseStatus> = {
  RECEIVED: '접수',
  IN_PROGRESS: '진행',
  CLOSED: '종결',
  REFERRED: '연계',
};

export function toStatusLabel(code: string): CaseStatus | null {
  return (CASE_STATUS_LABEL as Record<string, CaseStatus>)[code] ?? null;
}

/**
 * 사례 상태 전이 규칙(백엔드 CaseStatus.canTransitionTo와 같다).
 * 접수 → 진행·연계, 진행 → 종결·연계. 종결·연계는 되돌릴 수 없다.
 */
export const NEXT_STATUS: Record<CaseStatusCode, CaseStatusCode[]> = {
  RECEIVED: ['IN_PROGRESS', 'REFERRED'],
  IN_PROGRESS: ['CLOSED', 'REFERRED'],
  CLOSED: [],
  REFERRED: [],
};

export function nextStatuses(code: string): CaseStatusCode[] {
  return (NEXT_STATUS as Record<string, CaseStatusCode[]>)[code] ?? [];
}

/** 종결·연계된 사례는 더 이상 상담 기록을 쓰지 않는다. */
export function isTerminalStatus(code: string): boolean {
  return code === 'CLOSED' || code === 'REFERRED';
}

/** 상태 변경 버튼에 쓰는 문구 */
export const STATUS_ACTION_LABEL: Record<CaseStatusCode, string> = {
  RECEIVED: '접수로 되돌리기',
  IN_PROGRESS: '상담 시작(진행으로 변경)',
  CLOSED: '상담 종결',
  REFERRED: '다른 기관으로 연계',
};

/** 접근 로그 표시용 이름 */
export const LOG_ACTION_LABEL: Record<string, string> = {
  READ_LIST: '목록 조회',
  READ: '조회',
  CREATE: '생성',
  UPDATE: '수정',
  UPDATE_STATUS: '상태 변경',
  ASSIGN: '상담사 배정',
  GENERATE: '요약 생성',
  CONFIRM: '요약 승인',
  SUBMIT: '상담 신청 제출',
  CONVERT: '신청 전환',
};

export const LOG_RESOURCE_LABEL: Record<string, string> = {
  CASE: '사례',
  SESSION: '회기',
  SUMMARY: '요약',
  INTAKE: '상담 신청',
  COUNSELOR: '상담사',
  CLIENT: '내담자',
};

export const INTAKE_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '접수됨',
  PROCESSED: '처리됨',
};
