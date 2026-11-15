import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { chatReducer, initialChatState, type ChatMessage, type ChatOption } from '../../chatbot/chatReducer';
import PageHead from '../../components/PageHead';

/**
 * 비대면 보조 챗봇 (F-04). 안내·접수만 돕는다.
 * 질문지를 모두 답하면 ‘이대로 접수하기’가 신청서 화면(/apply)으로 이동하고, 거기서 이름(별칭)과 개인정보 동의를 확인해 실제 신청을 마친다.
 * 선택지 위주로 진행하고, 글로 쓴 내용은 위기 표현 → 질문지 답 → 상담 요청 → 낱말 연결 순서로 확인한다.
 */
export default function ChatbotPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, undefined, initialChatState);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.messages.length]);

  /** 챗봇에서 모은 답을 신청서 화면으로 넘긴다(분야·힘든 점은 미리 채우고, 서버에 저장 칸이 없는 답은 안내만 한다). */
  const goToApply = () => {
    const { answers, crisis } = stateRef.current;
    navigate('/apply', {
      state: {
        fromChatbot: true,
        field: answers.field ?? '',
        ageGroup: answers.ageGroup ?? '',
        method: answers.method ?? '',
        time: answers.time ?? '',
        concern: answers.concern ?? '',
        crisis,
      },
    });
  };

  const choose = (option: ChatOption) => {
    if (state.submitting) return;
    if (option.id === 'submit') {
      goToApply();
      return;
    }
    dispatch({ type: 'choose', id: option.id, label: option.label });
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || state.submitting) return;
    dispatch({ type: 'text', text });
    setText('');
  };

  const lastBotId = [...state.messages].reverse().find((m) => m.from === 'bot')?.id;

  return (
    <>
      <PageHead title="챗봇 안내">기관과 프로그램을 안내받고, 상담 신청을 위한 질문지를 작성해요.</PageHead>

      <p className="banner">이 챗봇은 AI예요. 상담·진단·조언은 하지 않고, 안내와 접수만 도와요. 접수는 마지막에 신청서 화면에서 마무리해요.</p>

      <div className="chat">
        <div className="chat__log" role="log" aria-live="polite" aria-label="챗봇 대화">
          {state.messages.map((m) => (
            <Message key={m.id} message={m} showOptions={m.id === lastBotId && !state.submitting} onChoose={choose} />
          ))}
          {state.submitting ? <p className="chat__status" role="status">접수하는 중이에요.</p> : null}
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
            placeholder="궁금한 것을 쓰거나, 위 선택지를 눌러 주세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={state.submitting}
          />
          <button type="submit" className="btn btn--primary" disabled={!text.trim() || state.submitting}>
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
        {message.lines.map((line) => (
          <p key={line}>{line}</p>
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
