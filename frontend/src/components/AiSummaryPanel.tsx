import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, describeApiError } from '../api/http';
import {
  SUMMARY_FIELD_MAX,
  confirmSummary,
  describeConfirmError,
  describeGenerateError,
  fetchSummary,
  generateSummary,
  validateSummaryFields,
} from '../api/remoteSummaryApi';
import type { ApiSummary, ApiSummaryFields } from '../types';
import { formatDateTime } from '../utils/schedule';
import ConfirmInline from './ConfirmInline';
import StateMessage from './StateMessage';

interface Props {
  sessionId: number;
  /** 상담 기록이 비어 있지 않아야 요약을 만들 수 있다 */
  canGenerate: boolean;
  /** 이 회기에 요약이 생겼는지 알린다(요약이 생기면 기록 수정을 막는다) */
  onExistsChange?: (exists: boolean) => void;
  /** 상담사만 승인할 수 있다 */
  canConfirm: boolean;
}

type Key = keyof ApiSummaryFields;

const ITEMS: Array<{ key: Key; label: string; hint: string }> = [
  { key: 'complaint', label: '주요 고민', hint: '내담자가 가장 힘들어하는 점' },
  { key: 'intervention', label: '상담 개입 내용', hint: '이번 회기에서 다룬 내용과 상담자가 한 일' },
  { key: 'nextPlan', label: '향후 계획', hint: '다음 회기나 앞으로의 계획' },
];

function toForm(fields: ApiSummaryFields | null): Record<Key, string> {
  return {
    complaint: fields?.complaint ?? '',
    intervention: fields?.intervention ?? '',
    nextPlan: fields?.nextPlan ?? '',
  };
}

/**
 * AI 상담 요약 — 생성, 검토·수정, 상담사 승인.
 * AI가 만든 초안은 자동으로 확정하지 않는다. 상담사가 내용을 확인하고 승인해야 확정(CONFIRMED)된다.
 */
export default function AiSummaryPanel({ sessionId, canGenerate, onExistsChange, canConfirm }: Props) {
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [slow, setSlow] = useState(false); // AI 호출이 오래 걸릴 때 안내를 덧붙인다
  const [generateError, setGenerateError] = useState('');
  const [form, setForm] = useState<Record<Key, string>>(toForm(null));
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const apply = useCallback(
    (next: ApiSummary | null) => {
      setSummary(next);
      setForm(toForm(next?.status === 'CONFIRMED' ? next.finalSummary : next?.aiDraft ?? null));
      onExistsChange?.(next !== null);
    },
    [onExistsChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      apply(await fetchSummary(sessionId));
    } catch (e) {
      setLoadError(describeApiError(e, '요약을 불러오지 못했어요.'));
    } finally {
      setLoading(false);
    }
  }, [apply, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 요약 생성이 8초를 넘기면 ‘오래 걸릴 수 있어요’ 안내를 보여준다(서버·AI가 깨어나는 중일 수 있다).
  useEffect(() => {
    if (!generating) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [generating]);

  const generate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      apply(await generateSummary(sessionId));
    } catch (e) {
      setGenerateError(describeGenerateError(e));
      // 이미 요약이 만들어져 있었다면(409) 서버에 있는 요약을 보여준다.
      if (e instanceof ApiError && e.status === 409) await load();
    } finally {
      setGenerating(false);
    }
  };

  const validation = useMemo(
    () => validateSummaryFields({ complaint: form.complaint, intervention: form.intervention, nextPlan: form.nextPlan }),
    [form],
  );

  const edited = useMemo(() => {
    if (!summary) return false;
    const base = toForm(summary.aiDraft);
    return (Object.keys(base) as Key[]).some((k) => base[k].trim() !== form[k].trim());
  }, [summary, form]);

  const confirm = async () => {
    setConfirming(true);
    setConfirmError('');
    try {
      apply(await confirmSummary(sessionId, { complaint: form.complaint, intervention: form.intervention, nextPlan: form.nextPlan }));
      setAsking(false);
    } catch (e) {
      setAsking(false);
      setConfirmError(describeConfirmError(e));
      if (e instanceof ApiError && e.status === 409) await load();
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <StateMessage message="요약을 불러오는 중이에요." />;

  if (loadError && !summary) {
    return (
      <StateMessage
        role="alert"
        message={loadError}
        action={
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => void load()}>
            다시 불러오기
          </button>
        }
      />
    );
  }

  // 요약이 아직 없을 때
  if (!summary) {
    return (
      <div className="stack">
        <p>이 회기의 상담 기록으로 AI가 요약 초안을 만들어요. 초안은 상담사가 검토하고 승인해야 확정돼요.</p>
        {generating ? (
          <div className="state" role="status" aria-busy="true">
            <p>AI가 요약 초안을 만드는 중이에요. 잠시만 기다려 주세요.</p>
            {slow ? (
              <p className="field__hint">생각보다 오래 걸리고 있어요. 한동안 쓰지 않았다면 서버가 깨어나는 데 1분쯤 걸릴 수 있어요. 화면을 닫지 말고 기다려 주세요.</p>
            ) : null}
          </div>
        ) : (
          <>
            {generateError ? (
              <div role="alert">
                <p className="form-error">{generateError}</p>
                <p className="field__hint">상담 기록은 이미 저장되어 있어요. 요약은 나중에 다시 만들 수 있어요.</p>
              </div>
            ) : null}
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => void generate()} disabled={!canGenerate}>
                {generateError ? '다시 시도하기' : 'AI 요약 만들기'}
              </button>
            </div>
            {!canGenerate ? <p className="field__hint">상담 기록이 있어야 요약을 만들 수 있어요.</p> : null}
          </>
        )}
      </div>
    );
  }

  const confirmed = summary.status === 'CONFIRMED';

  // 승인 완료
  if (confirmed) {
    const finalFields = summary.finalSummary ?? summary.aiDraft;
    return (
      <div className="stack">
        <div className="field__row">
          <span className="tag" data-summary-status="CONFIRMED">승인 완료</span>
          <span className="field__hint">
            {summary.confirmedAt ? `${formatDateTime(summary.confirmedAt)}에 ` : ''}
            {summary.confirmedBy ? `상담사 #${summary.confirmedBy}이(가) ` : ''}승인했어요.
          </span>
        </div>
        <dl className="ai-summary">
          {ITEMS.map((item) => (
            <div key={item.key} className="ai-summary__item">
              <dt>{item.label}</dt>
              <dd>{finalFields[item.key] ?? <span className="muted">(비어 있음)</span>}</dd>
            </div>
          ))}
        </dl>
        <details className="ai-summary__draft">
          <summary>AI가 처음 만든 초안 보기{summary.modelName ? ` (모델: ${summary.modelName})` : ''}</summary>
          <dl className="ai-summary">
            {ITEMS.map((item) => (
              <div key={item.key} className="ai-summary__item">
                <dt>{item.label}</dt>
                <dd>{summary.aiDraft[item.key] ?? <span className="muted">(기록에 없는 항목)</span>}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    );
  }

  // 검토 전(DRAFT)
  return (
    <div className="stack">
      <div className="field__row">
        <span className="tag tag--plain" data-summary-status="DRAFT">검토 전</span>
        <span className="field__hint">AI가 만든 참고용 초안이에요{summary.modelName ? ` (모델: ${summary.modelName})` : ''}.</span>
      </div>
      <p className="banner">
        내용이 맞는지 확인하고 필요하면 고친 뒤 승인해 주세요. 승인하기 전에는 확정된 요약으로 저장되지 않아요.
      </p>

      {ITEMS.map((item) => (
        <div key={item.key} className="field">
          <label className="field__label" htmlFor={`summary-${item.key}`}>
            {item.label}
          </label>
          <textarea
            id={`summary-${item.key}`}
            className="field__input field__input--area"
            value={form[item.key]}
            maxLength={SUMMARY_FIELD_MAX}
            onChange={(e) => setForm((prev) => ({ ...prev, [item.key]: e.target.value }))}
            placeholder={summary.aiDraft[item.key] === null ? '기록에 없는 항목이에요. 필요하면 직접 적어 주세요.' : undefined}
            disabled={!canConfirm || confirming}
          />
          <span className="field__hint">
            {summary.aiDraft[item.key] === null ? `${item.hint} · AI가 기록에서 찾지 못한 항목이에요.` : item.hint}
          </span>
        </div>
      ))}

      {confirmError ? (
        <p className="form-error" role="alert">
          {confirmError}
        </p>
      ) : null}
      {canConfirm && validation && edited ? <p className="field__hint">{validation}</p> : null}

      {!canConfirm ? (
        <p className="field__hint">요약 승인은 담당 상담사만 할 수 있어요.</p>
      ) : asking ? (
        <ConfirmInline
          message="승인하면 이 요약이 확정되고 이후에는 고칠 수 없어요. 내용을 확인하셨나요?"
          confirmLabel="승인(확정)"
          busy={confirming}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(false)}
        />
      ) : (
        <div className="actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setConfirmError('');
              setAsking(true);
            }}
            disabled={validation !== null}
          >
            {edited ? '고친 내용으로 승인' : '이대로 승인'}
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => setForm(toForm(summary.aiDraft))}
            disabled={!edited || confirming}
          >
            AI 초안으로 되돌리기
          </button>
        </div>
      )}
    </div>
  );
}
