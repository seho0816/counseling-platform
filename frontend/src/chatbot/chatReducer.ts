import { CRISIS_RESPONSE } from '../constants/crisis';
import type { IntakeAnswers } from '../types';
import { ANSWER_LABEL, INTAKE_QUESTIONS, PROCEDURE_STEPS, PROGRAMS } from './script';
import { detectCrisis, isCounselingRequest } from './safety';

export interface ChatOption {
  id: string;
  label: string;
  /** 있으면 화면 이동 링크로 보여준다 */
  href?: string;
}

export interface ChatMessage {
  id: number;
  from: 'bot' | 'user';
  kind: 'normal' | 'crisis' | 'summary';
  lines: string[];
  /** 마지막 챗봇 메시지의 선택지만 화면에 보여준다 */
  options?: ChatOption[];
  summary?: Array<{ label: string; value: string }>;
}

export interface ChatState {
  messages: ChatMessage[];
  seq: number;
  mode: 'menu' | 'intake' | 'review' | 'done';
  qIndex: number;
  answers: Partial<IntakeAnswers>;
  /** 이번 대화에서 위기 표현이 한 번이라도 감지됐는지. 접수할 때 위기 표시로 넘긴다. */
  crisis: boolean;
  submitting: boolean;
}

export type ChatAction =
  | { type: 'choose'; id: string; label: string }
  | { type: 'text'; text: string }
  | { type: 'submitted'; intakeId: string; counselorName: string }
  | { type: 'submitFailed' };

const MAIN_OPTIONS: ChatOption[] = [
  { id: 'programs', label: '기관·프로그램 안내' },
  { id: 'procedure', label: '상담 신청 절차' },
  { id: 'intake', label: '초기 질문지 작성' },
  { id: 'counselors', label: '상담사 찾기', href: '/client/counselors' },
];

const HOME: ChatOption = { id: 'menu', label: '처음으로' };

type Draft = Omit<ChatMessage, 'id'>;

const bot = (lines: string[], options?: ChatOption[], extra?: Partial<Draft>): Draft => ({
  from: 'bot',
  kind: 'normal',
  lines,
  options,
  ...extra,
});

const user = (text: string): Draft => ({ from: 'user', kind: 'normal', lines: [text] });

function append(state: ChatState, drafts: Draft[], patch: Partial<ChatState> = {}): ChatState {
  let seq = state.seq;
  const added = drafts.map((d) => ({ ...d, id: (seq += 1) }));
  return { ...state, ...patch, messages: [...state.messages, ...added], seq };
}

export function initialChatState(): ChatState {
  const greeting = bot(
    [
      '안녕하세요. 저는 안내와 접수를 도와드리는 AI 챗봇이에요.',
      '상담이나 진단, 조언은 할 수 없어요. 대신 기관과 프로그램 안내, 상담 신청 절차, 초기 질문지 작성을 도와드릴게요.',
      '무엇부터 도와드릴까요?',
    ],
    MAIN_OPTIONS,
  );
  return {
    messages: [{ ...greeting, id: 1 }],
    seq: 1,
    mode: 'menu',
    qIndex: 0,
    answers: {},
    crisis: false,
    submitting: false,
  };
}

function questionMessage(index: number): Draft {
  const q = INTAKE_QUESTIONS[index];
  const options: ChatOption[] = (q.options ?? []).map((o) => ({ id: `answer:${o}`, label: o }));
  if (q.skippable) options.push({ id: 'skip', label: '건너뛰기' });
  options.push(HOME);
  return bot([`(${index + 1}/${INTAKE_QUESTIONS.length}) ${q.prompt}`], options);
}

function reviewMessage(answers: Partial<IntakeAnswers>): Draft {
  const summary = (Object.keys(ANSWER_LABEL) as Array<keyof IntakeAnswers>).map((key) => ({
    label: ANSWER_LABEL[key],
    value: answers[key] && answers[key] !== '' ? String(answers[key]) : '(쓰지 않았어요)',
  }));
  return bot(['아래 내용으로 접수할게요. 맞는지 확인해 주세요.'], [
    { id: 'submit', label: '이대로 접수하기' },
    { id: 'restart', label: '처음부터 다시 쓰기' },
    HOME,
  ], { kind: 'summary', summary });
}

function startIntake(state: ChatState, echo?: Draft): ChatState {
  return append(state, [...(echo ? [echo] : []), questionMessage(0)], { mode: 'intake', qIndex: 0, answers: {} });
}

function menuMessage(): Draft {
  return bot(['무엇을 도와드릴까요?'], MAIN_OPTIONS);
}

/** 위기 표현에 대한 고정 응답. AI가 만든 문장이 아니라 constants/crisis.ts의 문구만 쓴다. (F-04-5) */
function crisisMessage(state: ChatState): Draft {
  const resume: ChatOption =
    state.mode === 'intake' || state.mode === 'review'
      ? { id: 'resume', label: state.mode === 'review' ? '접수 이어가기' : '질문 이어가기' }
      : { id: 'intake', label: '상담 접수 시작하기' };
  return bot([...CRISIS_RESPONSE], [resume, HOME], { kind: 'crisis' });
}

function resumeMessage(state: ChatState): Draft {
  if (state.mode === 'review') return reviewMessage(state.answers);
  return questionMessage(state.qIndex);
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'choose':
      return handleChoose(state, action.id, action.label);
    case 'text':
      return handleText(state, action.text);
    case 'submitted': {
      const lines = [
        `접수했어요. 접수번호는 ${action.intakeId}예요.`,
        `${action.counselorName} 상담사에게 전달됐어요. 담당 상담사가 질문지를 확인하면 상담 시간을 안내해 드려요.`,
      ];
      if (state.crisis) lines.push('대화 중 힘든 마음이 느껴져서 위기 표시를 남겼어요. 담당 상담사가 가장 먼저 확인해요.');
      return append(
        state,
        [bot(lines, [{ id: 'counselors', label: '상담사 찾기', href: '/client/counselors' }, HOME])],
        { mode: 'done', submitting: false },
      );
    }
    case 'submitFailed':
      return append(
        state,
        [bot(['접수하지 못했어요. 잠시 후 다시 시도해 주세요.'], [{ id: 'submit', label: '다시 접수하기' }, HOME])],
        { submitting: false },
      );
  }
}

function handleChoose(state: ChatState, id: string, label: string): ChatState {
  const echo = user(label);

  if (id === 'menu') return append(state, [echo, menuMessage()], { mode: 'menu', answers: {}, qIndex: 0 });

  if (id === 'programs') {
    return append(state, [
      echo,
      bot(
        ['안내해 드릴 수 있는 프로그램이에요. 궁금한 것을 골라 주세요.'],
        [...PROGRAMS.map((p) => ({ id: `program:${p.id}`, label: p.name })), HOME],
      ),
    ]);
  }

  if (id.startsWith('program:')) {
    const program = PROGRAMS.find((p) => p.id === id.slice('program:'.length));
    if (!program) return state;
    return append(state, [
      echo,
      bot(
        [
          `${program.name}: ${program.summary}`,
          `대상: ${program.target}`,
          `방식: ${program.method}`,
          `운영 시간: ${program.hours}`,
        ],
        [
          { id: 'programs', label: '다른 프로그램 보기' },
          { id: 'procedure', label: '상담 신청 절차' },
          { id: 'intake', label: '초기 질문지 작성' },
          HOME,
        ],
      ),
    ]);
  }

  if (id === 'procedure') {
    return append(state, [
      echo,
      bot(
        ['상담 신청은 이렇게 진행돼요.', ...PROCEDURE_STEPS.map((s, i) => `${i + 1}. ${s}`)],
        [{ id: 'intake', label: '초기 질문지 작성' }, { id: 'programs', label: '기관·프로그램 안내' }, HOME],
      ),
    ]);
  }

  if (id === 'intake' || id === 'restart') return startIntake(state, echo);

  if (id === 'resume') return append(state, [echo, resumeMessage(state)]);

  if (id === 'skip') {
    const answers = { ...state.answers, concern: '' };
    return append(state, [echo, reviewMessage(answers)], { mode: 'review', answers, qIndex: INTAKE_QUESTIONS.length });
  }

  if (id.startsWith('answer:') && state.mode === 'intake') {
    const q = INTAKE_QUESTIONS[state.qIndex];
    const answers = { ...state.answers, [q.id]: id.slice('answer:'.length) };
    const next = state.qIndex + 1;
    if (next >= INTAKE_QUESTIONS.length) {
      return append(state, [echo, reviewMessage(answers)], { mode: 'review', answers, qIndex: next });
    }
    return append(state, [echo, questionMessage(next)], { answers, qIndex: next });
  }

  if (id === 'submit') return { ...append(state, [echo]), submitting: true };

  return state;
}

function handleText(state: ChatState, rawText: string): ChatState {
  const text = rawText.trim();
  if (!text) return state;
  const echo = user(text);

  // 1) 위기 표현은 어떤 단계에서든 가장 먼저 확인하고, AI 응답 없이 고정 문구를 보여준다.
  if (detectCrisis(text)) {
    let next = state;
    if (state.mode === 'intake' && INTAKE_QUESTIONS[state.qIndex].freeText) {
      // 힘든 점을 적던 중이면 그 글을 답변으로 저장하고 확인 단계로 넘어갈 준비를 한다.
      const answers = { ...state.answers, concern: text };
      next = { ...state, mode: 'review', answers, qIndex: INTAKE_QUESTIONS.length };
    }
    next = { ...next, crisis: true };
    return append(next, [echo, crisisMessage(next)]);
  }

  // 2) 힘든 점을 적는 단계에서는 글을 그대로 답변으로 받는다.
  if (state.mode === 'intake' && INTAKE_QUESTIONS[state.qIndex].freeText) {
    const answers = { ...state.answers, concern: text };
    return append(state, [echo, reviewMessage(answers)], { mode: 'review', answers, qIndex: INTAKE_QUESTIONS.length });
  }

  // 3) 질문지 중간에 글로 답하면 선택지로 다시 안내한다.
  if (state.mode === 'intake') {
    return append(state, [echo, bot(['아래 선택지에서 골라 주시면 접수를 이어갈 수 있어요.']), questionMessage(state.qIndex)]);
  }

  // 4) 상담·진단·조언 요청: 역할 경계를 알리고 가능한 안내로 이어 준다. (F-04-4)
  if (isCounselingRequest(text)) {
    return append(state, [
      echo,
      bot(
        [
          '저는 상담이나 진단, 조언은 할 수 없어요. 정확한 도움을 드리지 못해서 미안해요.',
          '마음을 나누고 싶다면 상담사와의 상담을 신청해 보세요. 신청 절차나 초기 질문지 작성은 제가 도와드릴 수 있어요.',
        ],
        [{ id: 'procedure', label: '상담 신청 절차' }, { id: 'intake', label: '초기 질문지 작성' }, { id: 'counselors', label: '상담사 찾기', href: '/client/counselors' }, HOME],
      ),
    ]);
  }

  // 5) 간단한 낱말 연결
  if (/프로그램|기관/.test(text)) return handleChoose(state, 'programs', text);
  if (/절차|신청/.test(text)) return handleChoose(state, 'procedure', text);
  if (/질문지|접수/.test(text)) return handleChoose(state, 'intake', text);

  // 6) 그 밖의 글
  return append(state, [
    echo,
    bot(['아직 그 내용은 안내해 드리기 어려워요. 아래에서 골라 주세요.'], MAIN_OPTIONS),
  ]);
}
