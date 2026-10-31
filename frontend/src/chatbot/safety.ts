/**
 * 챗봇 안전 규칙 (F-04-4, F-04-5).
 * 위기 표현은 AI가 판단하거나 답하지 않고, 아래 규칙으로만 감지해 고정 문구를 보여준다.
 * 키워드 목록은 초안이며 상담 전문가의 검수를 받아 확정해야 한다.
 */
const CRISIS_KEYWORDS = [
  '죽고싶',
  '죽을것',
  '자살',
  '자해',
  '목숨',
  '사라지고싶',
  '사라져버리',
  '살기싫',
  '살고싶지않',
  '극단적선택',
  '극단적인선택',
];

const normalize = (text: string) => text.replace(/\s+/g, '');

export function detectCrisis(text: string): boolean {
  const t = normalize(text);
  return CRISIS_KEYWORDS.some((k) => t.includes(k));
}

/** 상담·진단·조언을 요청하는 표현. 챗봇은 이런 요청에 답하지 않고 안내만 한다. */
const COUNSELING_PATTERNS = [/어떻게\s*해야/, /조언/, /진단/, /약\s*(을|은|이)?\s*(먹|복용|처방)/, /처방/, /치료/, /우울증\s*(인가|일까|이에요)/, /해결\s*방법/, /상담\s*해\s*줘/, /방법\s*(좀\s*)?알려/];

export function isCounselingRequest(text: string): boolean {
  return COUNSELING_PATTERNS.some((p) => p.test(text));
}
