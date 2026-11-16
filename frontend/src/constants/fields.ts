/** 상담 분야 분류(초안). 상담 신청서의 분야 선택지로 쓴다. 분류 목록은 팀 합의 후 확정한다. */
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
