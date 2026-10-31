import { useEffect, useState } from 'react';
import { listAccounts, listLogs, type AccountRow, type LogFilter } from '../../api/adminApi';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import type { AccessAction, AccessLog } from '../../types';
import { formatDateTime } from '../../utils/schedule';

const ACTIONS: AccessAction[] = ['조회', '등록', '작성', '수정', '확정', '상태 변경', '접근 차단'];
const INITIAL: LogFilter = { userId: 'all', action: 'all', blockedOnly: false };

/** 접근 로그 (F-05-3): 누가 어떤 사례를 언제 열람·수정했는지, 차단된 시도는 무엇인지 본다. */
export default function AdminHome() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<LogFilter>(INITIAL);
  const [logs, setLogs] = useState<AccessLog[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    listAccounts(user).then(setAccounts).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFailed(false);
    listLogs(user, filter)
      .then((data) => !cancelled && setLogs(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user, filter, retry]);

  const blocked = (logs ?? []).filter((l) => !l.allowed).length;
  const filtered = filter.userId !== 'all' || filter.action !== 'all' || filter.blockedOnly;

  return (
    <>
      <PageHead title="접근 로그">사례·기록·요약을 누가 언제 열람하거나 고쳤는지 확인해요. 사례 내용은 볼 수 없어요.</PageHead>

      <section className="filters" aria-label="로그 거르기">
        <div className="filters__row">
          <div className="field">
            <label className="field__label" htmlFor="log-user">
              사용자
            </label>
            <select id="log-user" className="field__input" value={filter.userId} onChange={(e) => setFilter({ ...filter, userId: e.target.value })}>
              <option value="all">전체</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="log-action">
              동작
            </label>
            <select
              id="log-action"
              className="field__input"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value as AccessAction | 'all' })}
            >
              <option value="all">전체</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={filter.blockedOnly} onChange={(e) => setFilter({ ...filter, blockedOnly: e.target.checked })} />
          차단된 시도만 보기
        </label>
      </section>

      {failed ? (
        <StateMessage
          role="alert"
          message="로그를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </button>
          }
        />
      ) : logs === null ? (
        <StateMessage message="로그를 불러오는 중이에요." />
      ) : (
        <>
          <div className="result-meta">
            <p aria-live="polite">
              로그 {logs.length}건{blocked > 0 ? `, 그중 차단 ${blocked}건` : ''}
            </p>
            {filtered ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setFilter(INITIAL)}>
                조건 지우기
              </button>
            ) : null}
          </div>
          {logs.length === 0 ? (
            <StateMessage message="조건에 맞는 로그가 없어요. 조건을 바꿔 보세요." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">접근 로그 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">시각</th>
                    <th scope="col">사용자</th>
                    <th scope="col">동작</th>
                    <th scope="col">대상</th>
                    <th scope="col">결과</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 100).map((l) => (
                    <tr key={l.id}>
                      <td>{formatDateTime(l.at)}</td>
                      <td>{l.userName}</td>
                      <td>{l.action}</td>
                      <td className="cell-wrap">{l.target}</td>
                      <td>
                        <span className={`tag ${l.allowed ? 'tag--plain' : 'tag--alert'}`}>{l.allowed ? '허용' : '차단'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
