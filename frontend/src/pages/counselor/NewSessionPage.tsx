import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createSession, getCase } from '../../api/caseApi';
import { ForbiddenError } from '../../api/caseGuard';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import { SESSION_METHOD_LABEL } from '../../constants/fields';
import { stateOf } from '../../domain/caseState';
import type { CounselingCase, SessionMethod } from '../../types';
import { toDateTimeLocal } from '../../utils/schedule';

/** 회기 추가와 상담 기록 작성 (F-01-2) */
export default function NewSessionPage() {
  const { caseId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<CounselingCase | null>(null);
  const [loadError, setLoadError] = useState('');
  const [heldAt, setHeldAt] = useState(() => toDateTimeLocal(new Date()));
  const [method, setMethod] = useState<SessionMethod>('chat');
  const [record, setRecord] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getCase(user, caseId)
      .then((data) => !cancelled && setItem(data))
      .catch((e) => !cancelled && setLoadError(e instanceof ForbiddenError ? e.message : '사례를 불러오지 못했어요.'));
    return () => {
      cancelled = true;
    };
  }, [user, caseId]);

  const back = (
    <Link className="back-link" to={`/counselor/cases/${caseId}`}>
      사례로 돌아가기
    </Link>
  );

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

  const state = stateOf(item.status);
  if (!state.canAddSession()) {
    return (
      <>
        {back}
        <StateMessage message={state.sessionBlockedReason() ?? '이 사례에는 회기를 추가할 수 없어요.'} />
      </>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!record.trim()) {
      setError('상담 기록을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await createSession(user, caseId, { heldAt, method, record });
      navigate(`/counselor/cases/${caseId}/sessions/${session.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <>
      {back}
      <PageHead title={`${item.clientAlias} ${item.sessionCount + 1}회기 기록`}>
        상담 내용을 기록해요. 저장한 뒤 AI 요약을 만들 수 있어요. 가상 데이터만 입력해 주세요.
      </PageHead>

      <form className="form form--narrow" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="heldAt">
            상담 일시
          </label>
          <input id="heldAt" type="datetime-local" className="field__input" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="method">
            상담 방식
          </label>
          <select id="method" className="field__input" value={method} onChange={(e) => setMethod(e.target.value as SessionMethod)}>
            {(Object.keys(SESSION_METHOD_LABEL) as SessionMethod[]).map((m) => (
              <option key={m} value={m}>
                {SESSION_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="record">
            상담 기록
          </label>
          <textarea
            id="record"
            className="field__input field__input--area"
            rows={12}
            value={record}
            onChange={(e) => setRecord(e.target.value)}
          />
          <span className="field__hint">{record.trim().length}자. 20자 이상이면 AI 요약을 만들 수 있어요.</span>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? '저장하는 중이에요' : '기록 저장'}
          </button>
          <Link className="btn btn--quiet" to={`/counselor/cases/${caseId}`}>
            취소
          </Link>
        </div>
      </form>
    </>
  );
}
