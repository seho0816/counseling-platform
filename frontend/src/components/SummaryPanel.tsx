import { useState } from 'react';
import { editedFlags } from '../api/summaryApi';
import type { SessionSummary, SummaryFields, SummaryKey } from '../types';
import { formatDateTime } from '../utils/schedule';
import ConfirmInline from './ConfirmInline';
import StateMessage from './StateMessage';

export type SummaryPhase = 'idle' | 'generating' | 'error';

interface Props {
  summary: SessionSummary | null;
  phase: SummaryPhase;
  errorMessage: string;
  canGenerate: boolean;
  evidenceKey: SummaryKey | null;
  onToggleEvidence: (key: SummaryKey) => void;
  onGenerate: () => void;
  onManual: () => void;
  onSaveDraft: (fields: SummaryFields) => Promise<void>;
  onConfirm: (fields: SummaryFields) => Promise<void>;
}

const ITEMS: Array<{ key: SummaryKey; label: string }> = [
  { key: 'complaint', label: '주요 호소' },
  { key: 'intervention', label: '개입 내용' },
  { key: 'nextPlan', label: '다음 계획' },
];

export default function SummaryPanel(props: Props) {
  const { summary, phase, errorMessage, canGenerate } = props;

  if (phase === 'generating') {
    return (
      <div aria-busy="true">
        <StateMessage message="AI가 요약 초안을 만드는 중이에요. 이름과 연락처는 가려서 보내요." />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="stack">
        {phase === 'error' ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <p>아직 이 회기의 요약이 없어요. AI가 초안을 만들면 검토하고 고쳐서 확정해요.</p>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={props.onGenerate} disabled={!canGenerate}>
            {phase === 'error' ? '다시 시도하기' : 'AI 요약 만들기'}
          </button>
          <button type="button" className="btn btn--quiet" onClick={props.onManual}>
            직접 작성하기
          </button>
        </div>
        {!canGenerate ? <p className="field__hint">상담 기록을 20자 이상 쓰면 요약을 만들 수 있어요.</p> : null}
      </div>
    );
  }

  // 항목 입력값은 요약이 바뀔 때마다 새로 시작한다.
  return <SummaryEditor key={`${summary.id}-${summary.generatedAt}-${summary.status}`} {...props} summary={summary} />;
}

function SummaryEditor({
  summary,
  evidenceKey,
  onToggleEvidence,
  onGenerate,
  onSaveDraft,
  onConfirm,
}: Props & { summary: SessionSummary }) {
  const [fields, setFields] = useState<SummaryFields>(summary.fields);
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [error, setError] = useState('');
  const [askRegenerate, setAskRegenerate] = useState(false);
  const [askConfirm, setAskConfirm] = useState(false);

  const confirmed = summary.status === 'confirmed';
  const allFilled = ITEMS.every(({ key }) => fields[key].trim() !== '');
  const edited = editedFlags(summary);
  const dirty = ITEMS.some(({ key }) => fields[key] !== summary.fields[key]);

  const run = async (kind: 'save' | 'confirm', action: (f: SummaryFields) => Promise<void>) => {
    setBusy(kind);
    setError('');
    try {
      await action(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(null);
      return;
    }
    setBusy(null);
    setAskConfirm(false);
  };

  const evidenceFor = (key: SummaryKey) => summary.evidence?.[key] ?? [];

  const evidenceButton = (key: SummaryKey) =>
    evidenceFor(key).length > 0 ? (
      <button
        type="button"
        className="btn btn--quiet btn--sm"
        aria-pressed={evidenceKey === key}
        onClick={() => onToggleEvidence(key)}
      >
        {evidenceKey === key ? '근거 표시 끄기' : '원문 근거 보기'}
      </button>
    ) : null;

  if (confirmed) {
    return (
      <div className="stack">
        <p className="banner banner--ok">
          {summary.confirmedBy} 상담사가 {summary.confirmedAt ? formatDateTime(summary.confirmedAt) : ''}에 확정한 요약이에요.
        </p>
        <dl className="summary">
          {ITEMS.map(({ key, label }) => (
            <div key={key} className="summary__item">
              <dt>
                {label}
                {summary.source === 'ai' ? (
                  <span className={`tag ${edited[key] ? '' : 'tag--plain'}`}>
                    {edited[key] ? 'AI 초안에서 수정함' : 'AI 초안 그대로'}
                  </span>
                ) : (
                  <span className="tag tag--plain">직접 작성</span>
                )}
              </dt>
              <dd>{summary.fields[key]}</dd>
              <div>{evidenceButton(key)}</div>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="banner">
        {summary.source === 'ai'
          ? '참고용 초안이에요. 내용을 확인하고 고친 뒤 확정해야 정식 기록으로 저장돼요.'
          : '직접 작성 중이에요. 확정해야 정식 기록으로 저장돼요.'}
      </p>
      {summary.source === 'ai' ? (
        <p className="field__hint">
          {summary.maskedCount > 0
            ? `외부 AI로 보내기 전에 이름·연락처 ${summary.maskedCount}건을 가렸어요.`
            : '가릴 개인정보는 없었어요.'}
        </p>
      ) : null}

      {ITEMS.map(({ key, label }) => (
        <div key={key} className="field">
          <div className="field__row">
            <label className="field__label" htmlFor={`sum-${key}`}>
              {label}
            </label>
            {evidenceButton(key)}
          </div>
          <textarea
            id={`sum-${key}`}
            className="field__input field__input--area"
            rows={4}
            value={fields[key]}
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          />
        </div>
      ))}

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {askConfirm ? (
        <ConfirmInline
          message="확정하면 이 요약은 정식 기록이 되고 더 고칠 수 없어요. 확정할까요?"
          confirmLabel="확정하여 저장"
          busy={busy === 'confirm'}
          onConfirm={() => run('confirm', onConfirm)}
          onCancel={() => setAskConfirm(false)}
        />
      ) : askRegenerate ? (
        <ConfirmInline
          message="다시 만들면 지금 고친 내용이 사라지고 새 초안으로 바뀌어요. 다시 만들까요?"
          confirmLabel="다시 만들기"
          onConfirm={() => {
            setAskRegenerate(false);
            onGenerate();
          }}
          onCancel={() => setAskRegenerate(false)}
        />
      ) : (
        <div className="actions">
          <button type="button" className="btn btn--primary" disabled={!allFilled || busy !== null} onClick={() => setAskConfirm(true)}>
            확정하여 저장
          </button>
          <button type="button" className="btn btn--quiet" disabled={!dirty || busy !== null} onClick={() => run('save', onSaveDraft)}>
            {busy === 'save' ? '저장하는 중이에요' : '초안 저장'}
          </button>
          <button type="button" className="btn btn--quiet" disabled={busy !== null} onClick={() => setAskRegenerate(true)}>
            다시 만들기
          </button>
        </div>
      )}
      {!allFilled ? <p className="field__hint">세 항목을 모두 채우면 확정할 수 있어요.</p> : null}
    </div>
  );
}
