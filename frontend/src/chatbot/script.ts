/**
 * 챗봇 고정 문구와 초기 질문지 3단계.
 * 기관·프로그램 안내와 상담 신청 절차 설명은 서버(규칙 기반 + AI 안내)가 답하므로 화면에 가상 정보를 두지 않는다.
 */

/** 서버 신청서(POST /api/intakes)의 concernCategory와 이어지는 분야 선택지 */
export const INTAKE_CATEGORIES = ['진로·학업', '대인관계', '우울·불안', '기타'] as const;

/** 서버 신청서의 hasPriorCounseling(true / false / null)과 이어지는 선택지 */
export const PRIOR_OPTIONS = ['있음', '없음', '답하지 않음'] as const;

/** 메뉴 버튼을 눌렀을 때 서버 챗봇에 보내는 질문 */
export const MENU_QUESTIONS = {
  programs: '기관과 프로그램을 안내해 주세요.',
  procedure: '상담 신청은 어떻게 하나요?',
} as const;

export interface ChatIntakeAnswers {
  field: string;
  concern: string;
  prior: string;
}

export interface IntakeQuestion {
  id: keyof ChatIntakeAnswers;
  prompt: string;
  options?: string[];
  /** 자유롭게 글로 적는 질문. 쓴 글은 서버 챗봇에도 보내 위기 표현을 확인한다. */
  freeText?: boolean;
  skippable?: boolean;
}

/** 초기 질문지 3단계 (F-04-3) */
export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  { id: 'field', prompt: '어떤 분야의 상담을 원하시나요?', options: [...INTAKE_CATEGORIES] },
  { id: 'concern', prompt: '어떤 점이 가장 고민되시나요? 쓰고 싶지 않으면 건너뛰어도 돼요.', freeText: true, skippable: true },
  { id: 'prior', prompt: '이전에 상담받은 경험이 있나요?', options: [...PRIOR_OPTIONS] },
];

export const ANSWER_LABEL: Record<keyof ChatIntakeAnswers, string> = {
  field: '상담 분야',
  concern: '고민',
  prior: '이전 상담 경험',
};
