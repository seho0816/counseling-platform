import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { describeApiError, serverDetail } from '../../api/http';
import { fetchCase } from '../../api/remoteCaseApi';
import {
  SESSION_CONTENT_MAX,
  createSession,
  describeSessionError,
  fetchSessions,
  validateSessionInput,
} from '../../api/remoteSessionApi';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import { isTerminalStatus } from '../../constants/labels';
import type { CaseRow } from '../../types';
import { todayIso } from '../../utils/format';

/** 새 상담 기록 작성(POST /api/cases/{caseId}/sessions) — 담당 상담사만 쓴다. */
export default function NewSessionPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(caseId);
  const validId = Number.isInteger(id) && id > 0;

  const [item, setItem] = useState<CaseRow | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sessionNumber, setSessionNumber] = useState('1');
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [content, setContent] = useState('');
  const [existingNumbers, setExistingNumbers] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    Promise.all([fetchCase(id), fetchSessions(id)])
      .then(([row, sessions]) => {
        if (cancelled) return;
        setItem(row);
        const numbers = sessions.map((s) => s.sessionNumber);
        setExistingNumbers(numbers);
        setSessionNumber(String((numbers.length ? Math.max(...numbers) : 0) + 1));
      })
      .catch((e) => !cancelled && setLoadError(describeApiError(e, '사례를 불러오지 못했어요.')));
    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  const back = (
    <Link className="back-link" to={`/counselor/cases/${caseId}`}>
      사례로 돌아가기
    </Link>
  );

  if (!validId) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="주소의 사례 번호가 올바르지 않아요." />
      </>
    );
  }
  if (loadError) {
    return (
      <>
        {back}
        <StateMessage role="alert" message={loadError} />
      </>
    );
  }
  if (!item) {
    return (
      <>
        {back}
        <StateMessage message="사례를 불러오는 중이에요." />
      </>
    );
  }
  if (isTerminalStatus(item.statusRaw)) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="종결·연계된 사례에는 새 상담 기록을 쓸 수 없어요." />
      </>
    );
  }

  const number = Number(sessionNumber);
  const duplicate = existingNumbers.includes(number);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDetail(null);
    const input = { sessionNumber: sessionNumber.trim() === '' ? null : number, sessionDate, content };
    const problem = validateSessionInput(input);
    if (problem) return setError(problem);
    if (duplicate) return setError('이미 같은 회차 번호의 기록이 있어요. 회차 번호를 바꿔 주세요.');
    setBusy(true);
    try {
      const created = await createSession(id, { sessionNumber: number, sessionDate, content });
      navigate(`/counselor/cases/${id}/sessions/${created.id}`, { replace: true, state: { notice: '상담 기록을 저장했어요.' } });
    } catch (err) {
      setError(describeSessionError(err, 'create'));
      setDetail(serverDetail(err));
      setBusy(false);
    }
  };

  return (
    <>
      {back}
      <PageHead title="새 상담 기록">
        {item.alias} · {item.title}
      </PageHead>

      <form className="form form--narrow" onSubmit={handleSubmit} noValidate>
        <div className="field__row">
          <div className="field">
            <label className="field__label" htmlFor="session-number">
              회차
            </label>
            <input
              id="session-number"
              type="number"
              min={1}
              max={500}
              className="field__input"
              inputMode="numeric"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value)}
              aria-invalid={duplicate}
            />
            {duplicate ? <span className="form-error">이미 있는 회차예요.</span> : <span className="field__hint">다음 회차가 자동으로 들어가요.</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="session-date">
              상담 날짜
            </label>
            <input
              id="session-date"
              type="date"
              className="field__input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="session-content">
            상담 기록
          </label>
          <textarea
            id="session-content"
            className="field__input field__input--area"
            style={{ minHeight: 220 }}
            maxLength={SESSION_CONTENT_MAX}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="이번 회기에서 있었던 일을 적어 주세요. 실제 이름이나 연락처는 쓰지 마세요."
          />
          <span className="field__hint">
            {content.trim().length.toLocaleString()} / {SESSION_CONTENT_MAX.toLocaleString()}자. 저장한 뒤에 AI 요약을 만들 수 있어요.
          </span>
        </div>

        {error ? (
          <div role="alert">
            <p className="form-error">{error}</p>
            {detail ? <p className="field__hint">서버 메시지: {detail}</p> : null}
          </div>
        ) : null}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? '저장하는 중이에요' : '기록 저장'}
          </button>
          <Link className="btn btn--quiet" to={`/counselor/cases/${id}`}>
            취소
          </Link>
        </div>
      </form>
    </>
  );
}
