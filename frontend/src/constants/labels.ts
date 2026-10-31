import type { SummaryState } from '../types';

export const SUMMARY_LABEL: Record<SummaryState, string> = {
  none: '기록 없음',
  missing: '요약 필요',
  draft: '검토 필요',
  confirmed: '확정',
};
