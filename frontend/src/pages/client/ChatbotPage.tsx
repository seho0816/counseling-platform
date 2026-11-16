import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CHAT_MESSAGE_MAX, sendChatMessage } from '../../api/chatbotApi';
import { chatReducer, initialChatState, type ChatMessage, type ChatOption } from '../../chatbot/chatReducer';
import PageHead from '../../components/PageHead';

/** 서버가 오래 걸릴 때 \u2018늦어지고 있어요\u2019 안내를 덧붙이는 시간(밀리초) */
const SLOW_AFTER_MS = 10_000;

/**
 * 비대면 보조 챗봇 (F-04). 기관·프로그램 안내와 상담 신청만 돕는다(상담·진단·치료는 하지 않는다).
 * - 글로 묻거나 메뉴를 누르면 서버 챗봇 API(POST /api/chatbot/message)가 답한다.
 * - 위기 표현은 서버가 CRISIS로 알려 주면 고정 안내(109 전화 버튼 포함)로 보여준다.
 * - 초기 질문지 3단계를 모두 답하면 \u2018이대로 접수하기\u2019가 신청서 화면(/apply)으로 이동하고,
 *   거기서 이름(별칭)과 개인정보 동의를 확인해 실제 신청(POST /api/intakes)을 마친다.
 */
export default function ChatbotPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, undefined, initialChatState);
  const [text, setText] = useState('');
  const [slow, setSlow] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const aliveRef = useRef(true);
  const handledRef = useRef(0);

  const waiting = state.request !== null;
  const request = state.request;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.messages.length, waiting]);

  // 서버 응답을 기다리는 요청이 생기면 한 번만 보낸다.
  useEffect(() => {
    if (!request || handledRef.current === request.id) return;
    handledRef.current = request.id;
    sendChatMessage(request.message)
      .then((reply) => aliveRef.current && dispatch({ type: 'reply', requestId: request.id, reply }))
      .catch(() => aliveRef.current && dispatch({ type: 'replyFailed', requestId: request.id }));
  }, [request]);

  // 응답이 10초를 넘기면 안내를 덧붙인다(배포 서버가 깨어나는 중일 수 있다).
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  /** 챗봇에서 모은 답을 신청서 화면으로 넘긴다(분야·고민·이전 상담 경험은 미리 채운다). */
  const goToApply = () => {
    const { answers, crisis } = stateRef.current;
    navigate('/apply', {
      state: {
        fromChatbot: true,
        field: answers.field ?? '',
        concern: answers.concern ?? '',
        prior: answers.prior ?? '',
        crisis,
      },
    });
  };

  const choose = (option: ChatOption) => {
    if (waiting) return;
    if (option.id === 'submit') {
      goToApply();
      return;
    }
    dispatch({ type: 'choose', id: option.id, label: option.label });
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || waiting) return;
    dispatch({ type: 'text', text });
    setText('');
  };

  const lastBotId = [...state.messages].reverse().find((m) => m.from === 'bot')?.id;

  return (
    <>
      <PageHead title="챗봇 안내">기관과 프로그램을 안내받고, 상담 신청을 위한 질문지를 작성해요.</PageHead>
      <p className="banner">
        이 챗봇은 AI예요. 상담·진단·치료는 하지 않고, 기관 안내와 상담 신청만 도와요. 접수는 마지막에 신청서 화면에서 마무리해요.
      </p>

      <div className="chat">
        <div className="chat__log" role="log" aria-live="polite" aria-label="챗봇 대화">
          {state.messages.map((m) => (
            <Message key={m.id} message={m} showOptions={m.id === lastBotId && !waiting} onChoose={choose} />
          ))}
          {waiting ? (
            <div role="status" aria-busy="true">
              <p className="chat__status">답변을 준비하는 중이에요.</p>
              {slow ? (
                <p className="chat__status">
                  응답이 조금 늦어지고 있어요. 한동안 쓰지 않았다면 서버가 깨어나는 데 1분쯤 걸릴 수 있어요. 잠시만 기다려 주세요.
                </p>
              ) : null}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form className="chat__form" onSubmit={send}>
          <label className="visually-hidden" htmlFor="chat-input">
            메시지 입력
          </label>
          <input
            id="chat-input"
            className="field__input"
            autoComplete="off"
            maxLength={CHAT_MESSAGE_MAX}
            placeholder="궁금한 것을 쓰거나, 위 선택지를 눌러 주세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={waiting}
          />
          <button type="submit" className="btn btn--primary" disabled={!text.trim() || waiting}>
            보내기
          </button>
        </form>
      </div>
    </>
  );
}

function Message({
  message,
  showOptions,
  onChoose,
}: {
  message: ChatMessage;
  showOptions: boolean;
  onChoose: (option: ChatOption) => void;
}) {
  const mine = message.from === 'user';
  const cls = `bubble ${mine ? 'bubble--user' : 'bubble--bot'}${message.kind === 'crisis' ? ' bubble--crisis' : ''}`;
  return (
    <div className={`chat__row${mine ? ' chat__row--user' : ''}`}>
      <div className={cls}>
        {!mine ? <span className="visually-hidden">챗봇: </span> : <span className="visually-hidden">나: </span>}
        {message.lines.map((line, i) => (
          <p key={`${i}-${line}`}>{line}</p>
        ))}
        {message.kind === 'crisis' ? (
          <p>
            <a className="btn btn--primary btn--sm" href="tel:109">
              109에 전화하기
            </a>
          </p>
        ) : null}
        {message.summary ? (
          <dl className="kv kv--compact">
            {message.summary.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {showOptions && message.options ? (
          <div className="chips chat__options">
            {message.options.map((option) =>
              option.href ? (
                <Link key={option.id} className="chip" to={option.href}>
                  {option.label}
                </Link>
              ) : (
                <button key={option.id} type="button" className="chip" onClick={() => onChoose(option)}>
                  {option.label}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
