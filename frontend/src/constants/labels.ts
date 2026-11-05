import type { CaseStatus, CaseStatusCode, SummaryState } from '../types';

export const SUMMARY_LABEL: Record<SummaryState, string> = {
  none: '기록 없음',
  missing: '요약 필요',
  draft: '검토 필요',
  confirmed: '확정',
};

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
