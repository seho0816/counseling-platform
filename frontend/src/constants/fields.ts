import type { ConsultMethod, SessionMethod } from '../types';

/** 상담사 주 상담 분야 분류(초안). 요구사항 정의서의 미결 사항: 분류 목록은 팀 합의 후 확정. */
export const COUNSELING_FIELDS = [
  '우울·불안',
  '대인관계',
  '가족·부부',
  '직장·스트레스',
  '진로·학업',
  '청소년',
  '노인·돌봄',
  '경제·복지 연계',
] as const;

export type CounselingField = (typeof COUNSELING_FIELDS)[number];

export const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대', '60대 이상'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const METHOD_LABEL: Record<ConsultMethod, string> = {
  chat: '실시간 채팅',
  voice: '음성 메시지',
};

export const SESSION_METHOD_LABEL: Record<SessionMethod, string> = {
  chat: '실시간 채팅',
  voice: '음성 메시지',
  other: '기타',
};
