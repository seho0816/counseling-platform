import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeApiError } from '../api/http';
import { fetchSessions } from '../api/remoteSessionApi';
import { isTerminalStatus } from '../constants/labels';
import type { ApiSession, CaseRow } from '../types';
import { formatDateOnly, truncate } from '../utils/format';
import StateMessage from './StateMessage';

interface Props {
  item: CaseRow;
  /** 예: /counselor/cases/17 — 회기 주소는 이 뒤에 /sessions/... 를 붙인다 */
  casePath: string;
  /** 상담 기록은 담당 상담사만 쓴다 */
  canWrite: boolean;
}

/** 사례 상세에서 보는 상담 회기 목록(GET /api/cases/{id}/sessions)과 새 기록 쓰기 입구 */
export default function CaseSessionsPanel({ item, casePath, canWrite }: Props) {
  const [sessions, setSessions] = useState<ApiSession[] | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetchSessions(item.id)
      .then((list) => !cancelled && setSessions(list))
      .catch((e) => !cancelled && setError(describeApiError(e, '상담 회기를 불러오지 못했어요.')));
    return () => {
      cancelled = true;
    };
  }, [item.id, reloadKey]);

  const terminal = isTerminalStatus(item.statusRaw);

  return (
    <div className="stack">
      <div className="section__head">
        <h2 id="sessions-heading">상담 회기</h2>
        {canWrite && !terminal ? (
          <Link className="btn btn--primary btn--sm" to={`${casePath}/sessions/new`}>
            새 상담 기록 작성
          </Link>
        ) : null}
      </div>

      {canWrite && terminal ? (
        <p className="field__hint">종결·연계된 사례에는 새 상담 기록을 쓸 수 없어요. 기존 기록은 볼 수 있어요.</p>
      ) : null}
      {canWrite && item.statusRaw === 'RECEIVED' ? (
        <p className="field__hint">상담을 시작하면 위의 ‘상담 시작(진행으로 변경)’으로 상태를 바꿔 주세요.</p>
      ) : null}

      {error && !sessions ? (
        <StateMessage
          role="alert"
          message={error}
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setReloadKey((n) => n + 1)}>
              다시 불러오기
            </button>
          }
        />
      ) : sessions === null ? (
        <StateMessage message="상담 회기를 불러오는 중이에요." />
      ) : sessions.length === 0 ? (
        <StateMessage message="아직 상담 기록이 없어요. ‘새 상담 기록 작성’으로 첫 회기를 기록해 보세요." />
      ) : (
        <ul className="list" aria-labelledby="sessions-heading">
          {sessions.map((s) => (
            <li key={s.id} className="list__item">
              <div>
                <p className="list__title">
                  {s.sessionNumber}회기 · {formatDateOnly(s.sessionDate)}
                </p>
                <p className="list__preview">{truncate(s.content, 90)}</p>
              </div>
              <Link className="btn btn--quiet btn--sm" to={`${casePath}/sessions/${s.id}`} aria-label={`${s.sessionNumber}회기 열기`}>
                열기
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
