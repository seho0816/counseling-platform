import type { EvidenceMap, SummaryFields, SummaryKey } from '../types';

/**
 * 가짜 AI 요약기(Mock). 실제 LLM API로 교체하기 전까지 같은 입출력 모양을 흉내 낸다.
 * - 외부로 보내기 전에 이름·연락처를 가린다 (F-02-3).
 * - 상담 기록에서 핵심 문장을 골라 주요 호소·개입 내용·다음 계획으로 나눈다 (F-02-1).
 * - 요약 문장마다 근거가 된 원문 문장을 함께 돌려준다 (F-02-4).
 */

export interface MaskResult {
  text: string;
  count: number;
}

const MASK_RULES: Array<[RegExp, string]> = [
  [/\d{6}-\d{7}/g, '[주민번호]'],
  [/0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g, '[연락처]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[이메일]'],
  [/[가-힣]{2,4}\(가명\)/g, '[이름]'],
];

export function maskPII(text: string): MaskResult {
  let count = 0;
  let out = text;
  for (const [pattern, label] of MASK_RULES) {
    out = out.replace(pattern, () => {
      count += 1;
      return label;
    });
  }
  return { text: out, count };
}

export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?。\n]+[.!?。]*/g) ?? [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

const KEYWORDS: Record<SummaryKey, string[]> = {
  complaint: ['힘들', '불안', '잠', '스트레스', '걱정', '어려', '고민', '우울', '무기력', '답답', '외롭', '두렵', '갈등', '호소', '털어놓', '막막'],
  intervention: ['안내', '연습', '제안', '탐색', '정리', '함께', '연결', '설명', '시도', '확인', '나눠', '교육', '지지', '격려'],
  nextPlan: ['다음', '과제', '예정', '계획', '추후', '점검', '까지'],
};

const KEYS: SummaryKey[] = ['complaint', 'intervention', 'nextPlan'];

function score(sentence: string, key: SummaryKey): number {
  return KEYWORDS[key].reduce((sum, word) => (sentence.includes(word) ? sum + 1 : sum), 0);
}

export interface SummaryDraftResult {
  fields: SummaryFields;
  evidence: EvidenceMap;
  maskedCount: number;
}

export function generateSummaryDraft(record: string): SummaryDraftResult {
  const originals = splitSentences(record);
  const masked = originals.map((s) => maskPII(s));
  const maskedCount = masked.reduce((sum, m) => sum + m.count, 0);

  // 문장마다 가장 점수가 높은 항목에 배정한다 (동점이면 순서상 앞 항목).
  const buckets: Record<SummaryKey, number[]> = { complaint: [], intervention: [], nextPlan: [] };
  originals.forEach((sentence, index) => {
    // "다음 회기" 같은 계획 문장이 호소로 잘못 가지 않도록 계획 점수를 먼저 본다.
    const scores = KEYS.map((key) => ({ key, value: score(sentence, key) }));
    const best = scores.sort((a, b) => b.value - a.value)[0];
    if (best.value > 0) buckets[best.key].push(index);
  });

  // 빈 항목은 위치로 채운다: 호소는 앞쪽, 계획은 뒤쪽, 개입은 가운데.
  const last = originals.length - 1;
  if (originals.length > 0) {
    if (buckets.complaint.length === 0) buckets.complaint.push(0);
    if (buckets.nextPlan.length === 0) buckets.nextPlan.push(last);
    if (buckets.intervention.length === 0) buckets.intervention.push(Math.min(Math.floor(last / 2) + 1, last));
  }

  const fields = { complaint: '', intervention: '', nextPlan: '' } as SummaryFields;
  const evidence: EvidenceMap = { complaint: [], intervention: [], nextPlan: [] };
  for (const key of KEYS) {
    const picked = buckets[key].slice(0, 2);
    fields[key] = picked.map((i) => masked[i].text).join(' ');
    evidence[key] = picked.map((i) => originals[i]);
  }

  return { fields, evidence, maskedCount };
}

/** 두 요약 항목이 같은 내용인지(공백 차이는 무시) */
export function sameText(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
}
