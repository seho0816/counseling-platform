import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, describeApiError, serverDetail } from '../../api/http';
import { fetchCase } from '../../api/remoteCaseApi';
import {
  SESSION_CONTENT_MAX,
  describeSessionError,
  fetchSession,
  updateSession,
  validateSessionInput,
} from '../../api/remoteSessionApi';
import AiSummaryPanel from '../../components/AiSummaryPanel';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import type { ApiSession, CaseRow } from '../../types';
import { formatDateOnly } from '../../utils/format';
import { formatDateTime } from '../../utils/schedule';

/**
 * 상담 기록 상세와 AI 요약 검토·승인.
 * 기록 조회(GET), 수정(PATCH) / 요약 생성·조회·승인(POST·GET·PUT)을 한 화면에서 한다.
 */
export default function SessionPage() {
  const { caseId = '', sessionId = '' } = useParams();
  const location = useLocation();
  const cid = Number(caseId);
  const sid = Number(sessionId);
  const validIds = Number.isInteger(cid) && cid > 0 && Number.isInteger(sid) && sid > 0;

  const [item, setItem] = useState<CaseRow | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '');

  const [hasSummary, setHasSummary] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveDetail, setSaveDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!validIds) return;
    let cancelled = false;
    Promise.all([fetchCase(cid), fetchSession(cid, sid)])
      .then(([row, found]) => {
        if (cancelled) return;
        setItem(row);
        setSession(found);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? '이 상담 기록을 열 수 없어요. 없는 기록이거나 내게 배정된 사례가 아니에요.'
            : describeApiError(e, '상담 기록을 불러오지 못했어요.'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [cid, sid, validIds]);

  const back = (
    <Link className="back-link" to={`/counselor/cases/${caseId}`}>
      사례로 돌아가기
    </Link>
  );

  if (!validIds) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="주소의 번호가 올바르지 않아요." />
      </>
    );
  }
  if (error) {
    return (
      <>
        {back}
        <StateMessage role="alert" message={error} />
      </>
    );
  }
  if (!item || !session) {
    return (
      <>
        {back}
        <StateMessage message="상담 기록을 불러오는 중이에요." />
      </>
    );
  }

  const startEdit = () => {
    setDate(session.sessionDate);
    setContent(session.content);
    setSaveError('');
    setSaveDetail(null);
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveDetail(null);
    const problem = validateSessionInput({ sessionDate: date, content });
    if (problem) return setSaveError(problem);
    setSaving(true);
    try {
      setSession(await updateSession(cid, sid, { sessionDate: date, content }));
      setEditing(false);
      setNotice('상담 기록을 고쳤어요.');
    } catch (err) {
      setSaveError(describeSessionError(err, 'update'));
      setSaveDetail(serverDetail(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {back}
      <PageHead title={`${session.sessionNumber}회기 · ${formatDateOnly(session.sessionDate)}`}>
        {item.alias} · {item.title}
      </PageHead>

      {notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="section" aria-labelledby="record-heading">
        <div className="section__head">
          <h2 id="record-heading">상담 기록</h2>
          {!editing ? (
            <button type="button" className="btn btn--quiet btn--sm" onClick={startEdit} disabled={hasSummary}>
              기록 고치기
            </button>
          ) : null}
        </div>

        {hasSummary && !editing ? (
          <p className="field__hint">AI 요약이 만들어진 회기는 기록을 고칠 수 없어요(요약과 어긋나지 않게 하기 위해서예요).</p>
        ) : null}

        {editing ? (
          <form className="stack" onSubmit={save} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="edit-date">
                상담 날짜
              </label>
              <input id="edit-date" type="date" className="field__input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="edit-content">
                상담 기록
              </label>
              <textarea
                id="edit-content"
                className="field__input field__input--area"
                style={{ minHeight: 200 }}
                maxLength={SESSION_CONTENT_MAX}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <span className="field__hint">
                {content.trim().length.toLocaleString()} / {SESSION_CONTENT_MAX.toLocaleString()}자
              </span>
            </div>
            {saveError ? (
              <div role="alert">
                <p className="form-error">{saveError}</p>
                {saveDetail ? <p className="field__hint">서버 메시지: {saveDetail}</p> : null}
              </div>
            ) : null}
            <div className="actions">
              <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                {saving ? '저장하는 중이에요' : '고친 내용 저장'}
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEditing(false)} disabled={saving}>
                취소
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="record-view">{session.content}</p>
            <p className="field__hint">
              작성 {formatDateTime(session.createdAt)}
              {session.updatedAt ? ` · 최근 수정 ${formatDateTime(session.updatedAt)}` : ''}
            </p>
          </>
        )}
      </section>

      <section className="section" aria-labelledby="summary-heading">
        <h2 id="summary-heading">AI 상담 요약</h2>
        <AiSummaryPanel
          sessionId={sid}
          canGenerate={session.content.trim().length > 0 && !editing}
          canConfirm
          onExistsChange={setHasSummary}
        />
      </section>
    </>
  );
}
