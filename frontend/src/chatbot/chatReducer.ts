import { CRISIS_NOTICE } from '../constants/crisis';
import { isCrisisReply, type ChatReply } from '../api/chatbotApi';
import { ANSWER_LABEL, INTAKE_QUESTIONS, MENU_QUESTIONS, type ChatIntakeAnswers } from './script';

export interface ChatOption {
  id: string;
  label: string;
  /** 있으면 화면 이동 링크로 보여준다 */
  href?: string;
}

export interface ChatMessage {
  id: number;
  from: 'bot' | 'user';
  /** crisis는 위기 안내(109 전화 버튼 포함), error는 서버 오류 고정 안내 */
  kind: 'normal' | 'crisis' | 'summary' | 'error';
  lines: string[];
  /** 마지막 챗봇 메시지의 선택지만 화면에 보여준다 */
  options?: ChatOption[];
  summary?: Array<{ label: string; value: string }>;
}

/** 서버에 보낸 글이 어떤 상황에서 나온 것인지(응답을 어떻게 이어 보여줄지 정한다) */
export type RequestContext = 'ask' | 'menuText' | 'concern' | 'choiceText' | 'reviewText';

export interface ChatRequest {
  id: number;
  message: string;
  context: RequestContext;
}

export interface ChatState {
  messages: ChatMessage[];
  seq: number;
  mode: 'menu' | 'intake' | 'review';
  qIndex: number;
  answers: Partial<ChatIntakeAnswers>;
  /** 이번 대화에서 서버가 위기 표현으로 판단한 적이 있는지. 신청서 화면에 안전 안내를 함께 보여준다. */
  crisis: boolean;
  /** 서버 응답을 기다리는 요청. null이 아니면 기다리는 중이다. */
  request: ChatRequest | null;
  requestSeq: number;
}

export type ChatAction =
  | { type: 'choose'; id: string; label: string }
  | { type: 'text'; text: string }
  | { type: 'reply'; requestId: number; reply: ChatReply }
  | { type: 'replyFailed'; requestId: number };

const HOME: ChatOption = { id: 'menu', label: '처음으로' };
const APPLY_LINK: ChatOption = { id: 'apply', label: '신청서로 바로 가기', href: '/apply' };

const MAIN_OPTIONS: ChatOption[] = [
  { id: 'programs', label: '기관·프로그램 안내' },
  { id: 'procedure', label: '상담 신청 절차' },
  { id: 'intake', label: '초기 질문지 작성' },
  APPLY_LINK,
];

/** 서버 응답이 오지 않거나 오류일 때 보여주는 고정 안내(AI가 만든 문장이 아니다). */
export const CHAT_ERROR_LINES = [
  '지금은 안내를 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  `긴급한 위험이 있다면 즉시 119 또는 112에 연락해 주세요. ${CRISIS_NOTICE.hotlineName} ${CRISIS_NOTICE.hotlineNumber}에서도 도움받을 수 있어요.`,
];

type Draft = Omit<ChatMessage, 'id'>;

const bot = (lines: string[], options?: ChatOption[], extra?: Partial<Draft>): Draft => ({
  from: 'bot',
  kind: 'normal',
  lines,
  options,
  ...extra,
});

const user = (text: string): Draft => ({ from: 'user', kind: 'normal', lines: [text] });

/** 서버가 준 글을 줄 단위로 나눈다. HTML이나 마크다운은 해석하지 않고 글자 그대로 보여준다. */
const toLines = (text: string): string[] => text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

function append(state: ChatState, drafts: Draft[], patch: Partial<ChatState> = {}): ChatState {
  let seq = state.seq;
  const added = drafts.map((d) => ({ ...d, id: (seq += 1) }));
  return { ...state, ...patch, messages: [...state.messages, ...added], seq };
}

export function initialChatState(): ChatState {
  const greeting = bot(
    [
      '안녕하세요. 저는 안내와 접수를 도와드리는 AI 챗봇이에요.',
      '상담이나 진단, 치료는 할 수 없어요. 대신 기관과 프로그램 안내, 상담 신청 절차, 초기 질문지 작성을 도와드릴게요.',
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
    request: null,
    requestSeq: 0,
  };
}

function questionMessage(index: number): Draft {
  const q = INTAKE_QUESTIONS[index];
  const options: ChatOption[] = (q.options ?? []).map((o) => ({ id: `answer:${o}`, label: o }));
  if (q.skippable) options.push({ id: 'skip', label: '건너뛰기' });
  options.push(HOME);
  return bot([`(${index + 1}/${INTAKE_QUESTIONS.length}) ${q.prompt}`], options);
}

function reviewMessage(answers: Partial<ChatIntakeAnswers>): Draft {
  const summary = (Object.keys(ANSWER_LABEL) as Array<keyof ChatIntakeAnswers>).map((key) => ({
    label: ANSWER_LABEL[key],
    value: answers[key] && answers[key] !== '' ? String(answers[key]) : '(쓰지 않았어요)',
  }));
  return bot(
    [
      '아래 내용으로 접수할게요. 맞는지 확인해 주세요.',
      '\u2018이대로 접수하기\u2019를 누르면 신청서 화면으로 이동해요. 거기서 이름(별칭)과 개인정보 동의를 확인하고 제출하면 신청이 끝나요.',
    ],
    [{ id: 'submit', label: '이대로 접수하기' }, { id: 'restart', label: '처음부터 다시 쓰기' }, HOME],
    { kind: 'summary', summary },
  );
}

function menuMessage(): Draft {
  return bot(['무엇을 도와드릴까요?'], MAIN_OPTIONS);
}

/** 위기 응답. 글은 서버가 준 고정 안내를 그대로 쓰고, 화면은 109 전화 버튼과 이어가기 선택지만 더한다. */
function crisisMessage(state: ChatState, reply: ChatReply): Draft {
  const resume: ChatOption =
    state.mode === 'intake' || state.mode === 'review'
      ? { id: 'resume', label: state.mode === 'review' ? '접수 이어가기' : '질문 이어가기' }
      : { id: 'intake', label: '상담 접수 시작하기' };
  return bot(toLines(reply.reply), [resume, HOME], { kind: 'crisis' });
}

function resumeMessage(state: ChatState): Draft {
  if (state.mode === 'review') return reviewMessage(state.answers);
  return questionMessage(state.qIndex);
}

/** 서버 응답의 action에 따라 이어서 보여줄 선택지를 정한다. */
function optionsForAction(action: ChatReply['action']): ChatOption[] {
  if (action === 'OPEN_INTAKE') return [{ id: 'intake', label: '초기 질문지 작성' }, APPLY_LINK, HOME];
  return MAIN_OPTIONS; // SHOW_MENU, null, 알 수 없는 값
}

function startIntake(state: ChatState, echo?: Draft): ChatState {
  return append(state, [...(echo ? [echo] : []), questionMessage(0)], { mode: 'intake', qIndex: 0, answers: {} });
}

/** 서버에 글을 보내고 응답을 기다리는 상태로 바꾼다. */
function ask(state: ChatState, echo: Draft, message: string, context: RequestContext, patch: Partial<ChatState> = {}): ChatState {
  const id = state.requestSeq + 1;
  return append(state, [echo], { ...patch, requestSeq: id, request: { id, message, context } });
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'choose':
      return handleChoose(state, action.id, action.label);
    case 'text':
      return handleText(state, action.text);
    case 'reply':
      return handleReply(state, action.requestId, action.reply);
    case 'replyFailed':
      return handleFailure(state, action.requestId);
  }
}

function handleChoose(state: ChatState, id: string, label: string): ChatState {
  if (state.request) return state; // 응답을 기다리는 동안에는 선택을 받지 않는다
  const echo = user(label);
  if (id === 'menu') return append(state, [echo, menuMessage()], { mode: 'menu', answers: {}, qIndex: 0 });
  if (id === 'programs' || id === 'procedure') {
    return ask(state, echo, MENU_QUESTIONS[id], 'ask');
  }
  if (id === 'intake' || id === 'restart') return startIntake(state, echo);
  if (id === 'resume') return append(state, [echo, resumeMessage(state)]);
  if (id === 'skip' && state.mode === 'intake') {
    const q = INTAKE_QUESTIONS[state.qIndex];
    return advance(state, [echo], { ...state.answers, [q.id]: '' });
  }
  if (id.startsWith('answer:') && state.mode === 'intake') {
    const q = INTAKE_QUESTIONS[state.qIndex];
    return advance(state, [echo], { ...state.answers, [q.id]: id.slice('answer:'.length) });
  }
  return state;
}

/** 답을 저장하고 다음 질문(또는 확인 단계)으로 넘어간다. */
function advance(state: ChatState, before: Draft[], answers: Partial<ChatIntakeAnswers>): ChatState {
  const next = state.qIndex + 1;
  if (next >= INTAKE_QUESTIONS.length) return append(state, [...before, reviewMessage(answers)], { mode: 'review', answers, qIndex: next });
  return append(state, [...before, questionMessage(next)], { answers, qIndex: next });
}

function handleText(state: ChatState, rawText: string): ChatState {
  const text = rawText.trim();
  if (!text || state.request) return state;
  const echo = user(text);
  if (state.mode === 'intake') {
    const q = INTAKE_QUESTIONS[state.qIndex];
    // 고민을 적는 단계: 글을 답으로 저장하되, 위기 표현인지 서버에 확인한 뒤 다음 단계로 넘어간다.
    if (q.freeText) return ask(state, echo, text, 'concern', { answers: { ...state.answers, [q.id]: text } });
    return ask(state, echo, text, 'choiceText');
  }
  if (state.mode === 'review') return ask(state, echo, text, 'reviewText');
  return ask(state, echo, text, 'menuText');
}

function handleReply(state: ChatState, requestId: number, reply: ChatReply): ChatState {
  const req = state.request;
  if (!req || req.id !== requestId) return state; // 오래된 응답은 무시
  const crisis = isCrisisReply(reply);
  const base: ChatState = { ...state, request: null, crisis: state.crisis || crisis };

  switch (req.context) {
    case 'concern': {
      // 답은 이미 저장돼 있다. 위기 표현이면 안전 안내를 먼저 보여주고, 아니면 서버 응답은 쓰지 않고 다음 단계로 간다.
      const next = base.qIndex + 1;
      const moved: ChatState =
        next >= INTAKE_QUESTIONS.length ? { ...base, mode: 'review', qIndex: next } : { ...base, qIndex: next };
      if (crisis) return append(moved, [crisisMessage(moved, reply)]);
      return append(moved, [resumeMessage(moved)]);
    }
    case 'choiceText': {
      if (crisis) return append(base, [crisisMessage(base, reply)]);
      if (reply.type === 'GUIDE') return append(base, [bot(toLines(reply.reply)), questionMessage(base.qIndex)]);
      return append(base, [bot(['아래 선택지에서 골라 주시면 접수를 이어갈 수 있어요.']), questionMessage(base.qIndex)]);
    }
    case 'reviewText': {
      if (crisis) return append(base, [crisisMessage(base, reply)]);
      return append(base, [bot(toLines(reply.reply)), reviewMessage(base.answers)]);
    }
    case 'ask':
    case 'menuText':
    default: {
      if (crisis) return append(base, [crisisMessage(base, reply)]);
      return append(base, [bot(toLines(reply.reply), optionsForAction(reply.action))]);
    }
  }
}

function handleFailure(state: ChatState, requestId: number): ChatState {
  const req = state.request;
  if (!req || req.id !== requestId) return state;
  const base: ChatState = { ...state, request: null };
  const errorBubble = (options?: ChatOption[]): Draft => bot(CHAT_ERROR_LINES, options, { kind: 'error' });

  switch (req.context) {
    case 'concern': {
      // 서버를 쓸 수 없어도 접수는 이어갈 수 있게 한다. 고정 안내를 한 번 보여주고 다음 단계로 간다.
      const next = base.qIndex + 1;
      const moved: ChatState =
        next >= INTAKE_QUESTIONS.length ? { ...base, mode: 'review', qIndex: next } : { ...base, qIndex: next };
      return append(moved, [errorBubble(), resumeMessage(moved)]);
    }
    case 'choiceText':
      return append(base, [errorBubble(), questionMessage(base.qIndex)]);
    case 'reviewText':
      return append(base, [errorBubble(), reviewMessage(base.answers)]);
    case 'ask':
    case 'menuText':
    default:
      return append(base, [errorBubble(MAIN_OPTIONS)]);
  }
}
