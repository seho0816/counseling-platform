import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCase, updateRecord } from '../../api/caseApi';
import { ForbiddenError } from '../../api/caseGuard';
import {
  confirmSummary,
  createManualDraft,
  generateSummary,
  getSessionDetail,
  saveDraft,
} from '../../api/summaryApi';
import { useAuth } from '../../auth/AuthContext';
import HighlightedText from '../../components/HighlightedText';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import SummaryPanel, { type SummaryPhase } from '../../components/SummaryPanel';
import { SESSION_METHOD_LABEL } from '../../constants/fields';
import type { CounselingCase, Session, SessionSummary, SummaryFields, SummaryKey } from '../../types';
import { formatDateTime } from '../../utils/schedule';

type Load =
  | { kind: 'loading' }
  | { kind: 'blocked'; message: string }
  | { kind: 'error' }
  | { kind: 'ready' };

/**
 * 회기 화면: 왼쪽에 상담 기록, 오른쪽에 AI 요약.
 * 흐름: 요약 만들기 → 초안 검토·수정 → 확정 저장 (F-02). 확정 전에는 정식 기록이 아니다.
 */
export default function SessionPage() {
  const { caseId = '', sessionId = '' } = useParams();
  const { user } = useAuth();

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [item, setItem] = useState<CounselingCase | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const [recordText, setRecordText] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [recordChangedAfterDraft, setRecordChangedAfterDraft] = useState(false);

  const [phase, setPhase] = useState<SummaryPhase>('idle');
  const [phaseError, setPhaseError] = useState('');
  const [evidenceKey, setEvidenceKey] = useState<SummaryKey | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoad({ kind: 'loading' });
    Promise.all([getCase(user, caseId), getSessionDetail(user, caseId, sessionId)])
      .then(([c, detail]) => {
        if (cancelled) return;
        setItem(c);
        setSession(detail.session);
        setRecordText(detail.session.record);
        setSummary(detail.summary);
        setLoad({ kind: 'ready' });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoad(e instanceof ForbiddenError ? { kind: 'blocked', message: e.message } : { kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [user, caseId, sessionId]);

  const back = (
    <Link className="back-link" to={`/counselor/cases/${caseId}`}>
      사례로 돌아가기
    </Link>
  );

  if (load.kind === 'loading') {
    return (
      <>
        {back}
        <StateMessage message="회기를 불러오는 중이에요." />
      </>
    );
  }
  if (load.kind === 'blocked' || load.kind === 'error' || !item || !session || !user) {
    return (
      <>
        {back}
        <StateMessage
          role="alert"
          message={load.kind === 'blocked' ? load.message : '회기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}
        />
      </>
    );
  }

  const confirmed = summary?.status === 'confirmed';
  const recordDirty = recordText.trim() !== session.record.trim();
  const snippets = evidenceKey && summary?.evidence ? summary.evidence[evidenceKey] : [];

  const handleSaveRecord = async () => {
    setSavingRecord(true);
    setRecordError('');
    try {
      const saved = await updateRecord(user, caseId, sessionId, recordText);
      setSession(saved);
      setRecordText(saved.record);
      setNotice('상담 기록을 저장했어요.');
      if (summary) setRecordChangedAfterDraft(true);
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleGenerate = async () => {
    setPhase('generating');
    setPhaseError('');
    setEvidenceKey(null);
    setNotice('');
    try {
      const created = await generateSummary(user, caseId, sessionId);
      setSummary(created);
      setRecordChangedAfterDraft(false);
      setPhase('idle');
    } catch (e) {
      setPhaseError(e instanceof Error ? e.message : 'AI 요약을 만들지 못했어요.');
      setPhase('error');
    }
  };

  const handleManual = async () => {
    setPhaseError('');
    try {
      setSummary(await createManualDraft(user, caseId, sessionId));
      setPhase('idle');
    } catch (e) {
      setPhaseError(e instanceof Error ? e.message : '시작하지 못했어요.');
      setPhase('error');
    }
  };

  const handleSaveDraft = async (fields: SummaryFields) => {
    setSummary(await saveDraft(user, caseId, sessionId, fields));
    setNotice('초안을 저장했어요. 아직 확정 전이에요.');
  };

  const handleConfirm = async (fields: SummaryFields) => {
    setSummary(await confirmSummary(user, caseId, sessionId, fields));
    setEvidenceKey(null);
    setNotice('요약을 확정해 저장했어요.');
  };

  return (
    <>
      {back}
      <PageHead title={`${item.clientAlias} ${session.number}회기`}>
        {formatDateTime(session.heldAt)}, {SESSION_METHOD_LABEL[session.method]}
      </PageHead>

      {notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}

      <div className="split">
        <section aria-labelledby="record-heading" className="stack">
          <h2 id="record-heading">상담 기록</h2>

          {evidenceKey ? (
            <>
              <p className="field__hint">요약의 근거가 된 문장을 표시했어요.</p>
              <HighlightedText text={session.record} snippets={snippets} />
            </>
          ) : confirmed ? (
            <p className="record-text">{session.record}</p>
          ) : (
            <>
              <div className="field">
                <label className="visually-hidden" htmlFor="record-edit">
                  상담 기록
                </label>
                <textarea
                  id="record-edit"
                  className="field__input field__input--area"
                  rows={14}
                  value={recordText}
                  onChange={(e) => setRecordText(e.target.value)}
                />
                <span className="field__hint">{recordText.trim().length}자</span>
              </div>
              {recordError ? (
                <p className="form-error" role="alert">
                  {recordError}
                </p>
              ) : null}
              <div className="actions">
                <button type="button" className="btn btn--quiet btn--sm" disabled={!recordDirty || savingRecord} onClick={handleSaveRecord}>
                  {savingRecord ? '저장하는 중이에요' : '기록 저장'}
                </button>
              </div>
              {recordChangedAfterDraft ? (
                <p className="field__hint">기록을 고쳤어요. 요약에 반영하려면 ‘다시 만들기’를 눌러 주세요.</p>
              ) : null}
            </>
          )}
          {confirmed && !evidenceKey ? <p className="field__hint">요약을 확정한 회기의 기록은 고칠 수 없어요.</p> : null}
        </section>

        <section aria-labelledby="summary-heading" className="stack">
          <h2 id="summary-heading">AI 요약</h2>
          <SummaryPanel
            summary={summary}
            phase={phase}
            errorMessage={phaseError}
            canGenerate={recordText.trim().length >= 20 && !recordDirty}
            evidenceKey={evidenceKey}
            onToggleEvidence={(key) => setEvidenceKey((cur) => (cur === key ? null : key))}
            onGenerate={handleGenerate}
            onManual={handleManual}
            onSaveDraft={handleSaveDraft}
            onConfirm={handleConfirm}
          />
          {!summary && recordDirty ? <p className="field__hint">기록을 저장한 뒤에 요약을 만들 수 있어요.</p> : null}
        </section>
      </div>
    </>
  );
}
