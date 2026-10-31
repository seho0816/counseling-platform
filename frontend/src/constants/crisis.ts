/**
 * 위기 안내 문구(고정 응답용).
 * - AI가 생성하지 않고, 미리 정한 문구만 화면에 표시한다. (F-04-5)
 * - 문구와 연락처는 상담 전문가·기관 확인 후 확정한다.
 */
export const CRISIS_NOTICE = {
  hotlineName: '자살예방상담전화',
  hotlineNumber: '109',
  message: '지금 많이 힘들거나 스스로를 해칠 것 같다면, 기다리지 말고 바로 연락해 주세요.',
} as const;

/** 챗봇이 위기 표현을 감지했을 때 보여주는 고정 응답(AI 생성 아님). */
export const CRISIS_RESPONSE = [
  '지금 많이 힘드신 것 같아요. 이야기해 주셔서 고마워요. 혼자 견디지 않으셔도 괜찮아요.',
  `${CRISIS_NOTICE.hotlineName} ${CRISIS_NOTICE.hotlineNumber}번으로 지금 바로 연락해 주세요. 24시간 이야기를 들어줄 사람이 있어요.`,
  '원하시면 상담 접수를 이어서 도와드릴게요. 접수하면 담당 상담사가 가장 먼저 확인해요.',
] as const;
