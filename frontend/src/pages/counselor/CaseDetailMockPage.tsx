import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { changeStatus, getCase, getIntake, listSessions } from '../../api/caseApi';
import { ForbiddenError } from '../../api/caseGuard';
import { useAuth } from '../../auth/AuthContext';
import ConfirmInline from '../../components/ConfirmInline';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import SummaryBadge from '../../components/SummaryBadge';
import { SESSION_METHOD_LABEL } from '../../constants/fields';
import { SUMMARY_LABEL } from '../../constants/labels';
import { stateOf, toStatus } from '../../domain/caseState';
import type { CaseStatus, CounselingCase, IntakeForm, SessionRow } from '../../types';
import { formatDateTime, formatRelativeDay } from '../../utils/schedule';

type Load =
  | { kind: 'loading' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error' }
  | { kind: 'ready'; item: CounselingCase; sessions: SessionRow[]; intake: IntakeForm | null };

/**
 * (보존용) API 연결 전 Mock 사례 상세. 지금은 라우트에 연결하지 않았다.
 * 회기 이력·사례 상태 변경(State 패턴) 화면을 실제 API로 만들 때 참고한다.
 */
export default function CaseDetailMockPage() {
  const { caseId = '' } = useParams();
  const { user } = useAuth();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [pending, setPending] = useState<CaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const item = await getCase(user, caseId);
      const [sessions, intake] = await Promise.all([listSessions(user, caseId), getIntake(user, caseId)]);
      setLoad({ kind: 'ready', item, sessions, intake });
    } catch (e) {
      setLoad(e instanceof ForbiddenError ? { kind: 'forbidden', message: e.message } : { kind: 'error' });
    }
  }, [user, caseId]);

  useEffect(() => {
    setLoad({ kind: 'loading' });
    void refresh();
  }, [refresh]);

  const back = (
    <Link className="back-link" to="/counselor/cases">
      사례 목록으로 돌아가기
    </Link>
  );

  if (load.kind === 'loading') {
    return (
      <>
        {back}
        <StateMessage message="사례를 불러오는 중이에요." />
      </>
    );
  }
  if (load.kind === 'forbidden') {
    return (
      <>
        {back}
        <StateMessage role="alert" message={load.message} />
      </>
    );
  }
  if (load.kind === 'error') {
    return (
      <>
        {back}
        <StateMessage role="alert" message="사례를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />
      </>
    );
  }

  const { item, sessions, intake } = load;
  const state = stateOf(item.status);

  const applyStatus = async () => {
    if (!user || !pending) return;
    setBusy(true);
    setActionError('');
    try {
      await changeStatus(user, item.id, pending);
      await refresh(); // 화면을 새 상태로 먼저 맞춘 뒤 알린다
      setMessage(`사례 상태를 ${toStatus(pending)} 바꿨어요.`);
      setPending(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '상태를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {back}
      <PageHead title={item.clientAlias}>
        {item.ageGroup}, {item.concern}. 회기 {item.sessionCount}회, 최근 상담 {formatRelativeDay(item.lastSessionAt)}, 요약{' '}
        {SUMMARY_LABEL[item.summaryState]}
      </PageHead>

      {message ? (
        <p className="banner banner--ok" role="status">
          {message}
        </p>
      ) : null}

      <section className="section" aria-labelledby="state-heading">
        <h2 id="state-heading">사례 상태</h2>
        <div className="panel stack">
          <div className="list__meta">
            <StatusBadge status={item.status} />
            {item.crisisFlag ? <span className="tag tag--alert">위기 표시</span> : null}
            {item.source === '챗봇 접수' ? <span className="tag tag--plain">챗봇 접수</span> : null}
          </div>
          <p>{state.describe()}</p>

          {pending ? (
            <ConfirmInline
              message={state.confirmMessage(pending)}
              confirmLabel={`${toStatus(pending)} 변경`}
              busy={busy}
              onConfirm={applyStatus}
              onCancel={() => setPending(null)}
            />
          ) : state.nextStatuses().length > 0 ? (
            <div className="actions">
              {state.nextStatuses().map((next) => (
                <button key={next} type="button" className="btn btn--quiet btn--sm" onClick={() => setPending(next)}>
                  {next === '진행' ? '상담 시작(진행으로 변경)' : `${toStatus(next)} 변경`}
                </button>
              ))}
            </div>
          ) : null}
          {actionError ? (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </section>

      {intake ? (
        <section className="section" aria-labelledby="intake-heading">
          <h2 id="intake-heading">챗봇 접수 질문지</h2>
          <dl className="panel kv">
            <div>
              <dt>접수 시각</dt>
              <dd>{formatDateTime(intake.submittedAt)}</dd>
            </div>
            <div>
              <dt>상담 분야</dt>
              <dd>{intake.answers.field}</dd>
            </div>
            <div>
              <dt>연령대</dt>
              <dd>{intake.answers.ageGroup}</dd>
            </div>
            <div>
              <dt>희망 방식</dt>
              <dd>{intake.answers.method}</dd>
            </div>
            <div>
              <dt>편한 시간대</dt>
              <dd>{intake.answers.time}</dd>
            </div>
            <div>
              <dt>힘든 점</dt>
              <dd>{intake.answers.concern || '(쓰지 않았어요)'}</dd>
            </div>
          </dl>
          {intake.crisisFlag ? (
            <p className="form-error">내담자가 위기 표현을 입력해 위기 표시가 붙었어요. 가장 먼저 확인해 주세요.</p>
          ) : null}
        </section>
      ) : null}

      <section className="section" aria-labelledby="sessions-heading">
        <div className="section__head">
          <h2 id="sessions-heading">회기 이력 {sessions.length}회</h2>
          {state.canAddSession() ? (
            <Link className="btn btn--primary btn--sm" to={`/counselor/cases/${item.id}/sessions/new`}>
              회기 추가
            </Link>
          ) : null}
        </div>

        {!state.canAddSession() ? <p className="field__hint section__hint">{state.sessionBlockedReason()}</p> : null}

        {sessions.length === 0 ? (
          <StateMessage message="아직 회기가 없어요. 상담을 시작하면 회기를 추가하고 상담 기록을 써 보세요." />
        ) : (
          <ul className="list">
            {sessions.map((s) => (
              <li key={s.id} className="list__item">
                <div>
                  <p className="list__title">
                    {s.number}회기, {formatDateTime(s.heldAt)}
                  </p>
                  <div className="list__meta">
                    <span>{SESSION_METHOD_LABEL[s.method]}</span>
                    <SummaryBadge status={s.summaryStatus} />
                  </div>
                  <p className="list__preview">{s.record.length > 70 ? `${s.record.slice(0, 70)}…` : s.record}</p>
                </div>
                <Link
                  className="btn btn--quiet btn--sm"
                  to={`/counselor/cases/${item.id}/sessions/${s.id}`}
                  aria-label={`${s.number}회기 열기`}
                >
                  열기
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
