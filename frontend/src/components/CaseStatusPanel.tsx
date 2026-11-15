import { useState } from 'react';
import { ApiError, describeApiError, serverDetail } from '../api/http';
import { changeCaseStatus } from '../api/remoteCaseApi';
import { CASE_STATUS_LABEL, STATUS_ACTION_LABEL, nextStatuses } from '../constants/labels';
import type { CaseRow, CaseStatusCode } from '../types';
import ConfirmInline from './ConfirmInline';
import StatusBadge from './StatusBadge';

interface Props {
  item: CaseRow;
  /** 상태가 바뀌어 서버가 돌려준 최신 사례 */
  onChanged: (updated: CaseRow, message: string) => void;
}

/** 종결·연계는 되돌릴 수 없어서 한 번 더 확인한다. */
const NEEDS_CONFIRM: CaseStatusCode[] = ['CLOSED', 'REFERRED'];

function describeStatusError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return '지금 상태에서는 선택한 상태로 바꿀 수 없어요. 화면을 새로 불러와 현재 상태를 확인해 주세요.';
    if (error.status === 404) return '이 사례의 상태를 바꿀 수 없어요. 없는 사례이거나 내게 배정된 사례가 아니에요.';
    if (error.status === 400) return '상태 값을 서버가 받아들이지 못했어요.';
  }
  return describeApiError(error, '상태를 바꾸지 못했어요.');
}

/** 사례 상태 확인과 변경(PATCH /api/cases/{id}/status). 허용된 다음 상태만 버튼으로 보여준다. */
export default function CaseStatusPanel({ item, onChanged }: Props) {
  const [pending, setPending] = useState<CaseStatusCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<string | null>(null);

  const options = nextStatuses(item.statusRaw);

  const run = async (target: CaseStatusCode) => {
    setBusy(true);
    setError('');
    setDetail(null);
    try {
      const updated = await changeCaseStatus(item.id, target);
      setPending(null);
      onChanged(updated, `상태를 \u2018${CASE_STATUS_LABEL[target]}\u2019(으)로 바꿨어요.`);
    } catch (e) {
      setPending(null);
      setError(describeStatusError(e));
      setDetail(serverDetail(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (target: CaseStatusCode) => {
    setError('');
    if (NEEDS_CONFIRM.includes(target)) setPending(target);
    else void run(target);
  };

  return (
    <div className="panel stack">
      <div className="field__row">
        <span className="field__label">현재 상태</span>
        {item.status ? <StatusBadge status={item.status} /> : <span className="tag tag--plain">{item.statusRaw}</span>}
      </div>

      {options.length === 0 ? (
        <p className="field__hint">종결·연계된 사례는 상태를 더 바꿀 수 없어요.</p>
      ) : pending ? (
        <ConfirmInline
          message={`\u2018${CASE_STATUS_LABEL[pending]}\u2019(으)로 바꾸면 되돌릴 수 없고, 이후에는 새 상담 기록을 쓸 수 없어요. 바꿀까요?`}
          confirmLabel={`${CASE_STATUS_LABEL[pending]}(으)로 변경`}
          busy={busy}
          onConfirm={() => void run(pending)}
          onCancel={() => setPending(null)}
        />
      ) : (
        <div className="actions">
          {options.map((code) => (
            <button
              key={code}
              type="button"
              className={code === 'IN_PROGRESS' ? 'btn btn--primary btn--sm' : 'btn btn--quiet btn--sm'}
              onClick={() => choose(code)}
              disabled={busy}
            >
              {STATUS_ACTION_LABEL[code]}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div role="alert">
          <p className="form-error">{error}</p>
          {detail ? <p className="field__hint">서버 메시지: {detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
