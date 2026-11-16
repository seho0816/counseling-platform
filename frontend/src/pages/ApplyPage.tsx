import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { describeSubmitError, submitIntake, validateIntake } from '../api/remoteIntakeApi';
import Brand from '../components/Brand';
import PageHead from '../components/PageHead';
import SafetyNotice from '../components/SafetyNotice';
import { COUNSELING_FIELDS } from '../constants/fields';
import type { ApiIntakeAccepted } from '../types';

type Prior = 'yes' | 'no' | 'unknown';

/** 챗봇에서 신청서로 넘어올 때 함께 오는 값(챗봇 ‘이대로 접수하기’) */
interface ChatbotHandoff {
  fromChatbot?: boolean;
  field?: string;
  concern?: string;
  /** 챗봇 선택지 그대로: 있음 / 없음 / 답하지 않음 */
  prior?: string;
  crisis?: boolean;
}

/** 챗봇의 분야 선택을 신청서의 분야 목록에 맞춘다. 목록에 없으면 ‘기타’로 둔다. */
function toCategory(field: string | undefined): string {
  if (!field) return '';
  return field === '기타' || (COUNSELING_FIELDS as readonly string[]).includes(field) ? field : '기타';
}

/** 챗봇의 이전 상담 경험 선택을 신청서 선택지로 바꾼다. */
function toPrior(prior: string | undefined): Prior {
  if (prior === '있음') return 'yes';
  if (prior === '없음') return 'no';
  return 'unknown';
}

/**
 * 비회원 상담 신청(공개 화면, 로그인 없이 사용) — POST /api/intakes
 * 신청서는 관리자가 확인한 뒤 상담 사례로 전환하고 상담사를 배정한다.
 * 이 서비스는 실습용이므로 실제 이름·연락처 대신 가상 정보를 쓰도록 안내한다.
 */
export default function ApplyPage() {
  const handoff = ((useLocation().state as ChatbotHandoff | null) ?? {}) as ChatbotHandoff;
  const fromChatbot = handoff.fromChatbot === true;

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState(() => (fromChatbot ? toCategory(handoff.field) : ''));
  const [concern, setConcern] = useState(() => (fromChatbot ? (handoff.concern ?? '').trim() : ''));
  const [prior, setPrior] = useState<Prior>(() => (fromChatbot ? toPrior(handoff.prior) : 'unknown'));
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ApiIntakeAccepted | null>(null);

  const reset = () => {
    setName('');
    setContact('');
    setCategory('');
    setConcern('');
    setPrior('unknown');
    setConsent(false);
    setError('');
    setDone(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const input = {
      applicantName: name,
      applicantContact: contact,
      concernCategory: category,
      concernDescription: concern,
      hasPriorCounseling: prior === 'unknown' ? null : prior === 'yes',
      privacyConsent: consent,
    };
    const problem = validateIntake(input);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      setDone(await submitIntake(input));
      // 제출한 개인정보를 화면 상태에 남기지 않는다.
      setName('');
      setContact('');
      setConcern('');
    } catch (err) {
      setError(describeSubmitError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Brand to="/" />
          <nav className="topbar__nav" aria-label="공개 메뉴" />
          <div className="topbar__user">
            <Link className="btn btn--quiet btn--sm" to="/login">
              로그인
            </Link>
          </div>
        </div>
      </header>

      <main className="page">
        {done ? (
          <section aria-labelledby="done-heading" className="stack">
            <PageHead title="상담 신청이 접수되었어요">
              담당 기관이 신청 내용을 확인한 뒤 상담사를 배정해요. 접수 번호를 기억해 두세요.
            </PageHead>
            <div className="panel stack" role="status" id="done-heading">
              <p>
                접수 번호 <strong>{done.id}</strong>
              </p>
              <p className="field__hint">안전을 위해 이 화면에는 입력하신 내용을 다시 보여주지 않아요.</p>
            </div>
            <SafetyNotice />
            <div className="actions">
              <button type="button" className="btn btn--quiet" onClick={reset}>
                새 신청 작성
              </button>
              {fromChatbot ? (
                <Link className="btn btn--quiet" to="/client/chatbot">
                  챗봇으로 돌아가기
                </Link>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            <PageHead title="상담 신청">
              상담을 받고 싶은 분야와 고민을 알려 주세요. 기관이 확인한 뒤 상담사를 배정해요. 로그인은 필요 없어요.
            </PageHead>

            {fromChatbot && handoff.crisis ? (
              <div style={{ marginBottom: 20 }}>
                <SafetyNotice />
              </div>
            ) : null}

            {fromChatbot ? (
              <div className="banner" role="status">
                <p>
                  <strong>챗봇에서 입력한 내용을 가져왔어요.</strong> 이름(별칭)과 개인정보 동의를 확인하고 제출하면 상담 신청이 완료돼요.
                </p>
              </div>
            ) : null}

            <p className="banner banner--mock" role="note">
              <strong>실습용 서비스</strong> 이 서비스는 실습용이에요. 실제 이름과 연락처 대신 가상 정보(별칭)를 입력해 주세요.
            </p>

            <form className="form form--narrow" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label className="field__label" htmlFor="apply-name">
                  이름(별칭)
                </label>
                <input
                  id="apply-name"
                  className="field__input"
                  autoComplete="off"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 가상신청자A"
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="apply-contact">
                  연락처(선택)
                </label>
                <input
                  id="apply-contact"
                  className="field__input"
                  autoComplete="off"
                  value={contact}
                  maxLength={50}
                  onChange={(e) => setContact(e.target.value)}
                />
                <span className="field__hint">비워 둘 수 있어요. 실제 연락처는 입력하지 마세요.</span>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="apply-category">
                  상담받고 싶은 분야
                </label>
                <select id="apply-category" className="field__input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">분야를 선택해 주세요</option>
                  {COUNSELING_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="apply-concern">
                  고민 내용
                </label>
                <textarea
                  id="apply-concern"
                  className="field__input field__input--area"
                  value={concern}
                  maxLength={2000}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="요즘 어떤 점이 가장 고민인지 편하게 적어 주세요."
                />
                <span className="field__hint">{concern.trim().length.toLocaleString()} / 2,000자</span>
              </div>

              <fieldset className="fieldset">
                <legend className="field__label">이전에 상담을 받은 적이 있나요? (선택)</legend>
                <div className="chips" role="radiogroup" aria-label="이전 상담 경험">
                  {(
                    [
                      ['yes', '있어요'],
                      ['no', '없어요'],
                      ['unknown', '답하지 않을래요'],
                    ] as Array<[Prior, string]>
                  ).map(([value, label]) => (
                    <label key={value} className="check">
                      <input type="radio" name="prior" checked={prior === value} onChange={() => setPrior(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fieldset">
                <legend className="field__label">개인정보 수집·이용 동의 (필수)</legend>
                <div className="panel stack">
                  <ul className="consent-list">
                    <li>수집 항목: 이름(별칭), 연락처(선택), 상담 분야, 고민 내용, 이전 상담 경험</li>
                    <li>이용 목적: 상담 신청 접수와 상담사 배정</li>
                    <li>보관 기간: 실습 종료 시까지(가상 데이터만 사용)</li>
                    <li>동의하지 않으면 상담 신청을 할 수 없어요.</li>
                  </ul>
                  <label className="check">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    위 내용을 읽었고 개인정보 수집·이용에 동의해요.
                  </label>
                  <span className="field__hint">동의 문구는 초안이에요. 실제 운영 전에 기관 확인이 필요해요.</span>
                </div>
              </fieldset>

              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? '제출하는 중이에요' : '상담 신청하기'}
                </button>
              </div>
            </form>

            <div style={{ marginTop: 28 }}>
              <SafetyNotice />
            </div>
          </>
        )}
      </main>
    </>
  );
}
