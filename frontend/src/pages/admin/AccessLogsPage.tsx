import { useCallback, useEffect, useState } from 'react';
import { describeApiError } from '../../api/http';
import { fetchAccessLogs } from '../../api/remoteLogApi';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import { LOG_ACTION_LABEL, LOG_RESOURCE_LABEL } from '../../constants/labels';
import type { ApiAccessLogPage } from '../../types';
import { formatDateTime } from '../../utils/schedule';

const PAGE_SIZE = 20;

/** 접근 로그(GET /api/admin/logs) — 누가 언제 어떤 대상에 무엇을 했는지 보여준다. 관리자 전용. */
export default function AccessLogsPage() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApiAccessLogPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAccessLogs(page, PAGE_SIZE)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(describeApiError(e, '접근 로그를 불러오지 못했어요.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const head = <PageHead title="접근 로그">사례·기록·요약을 누가 언제 열람하거나 고쳤는지 최신순으로 보여줘요. 기록 내용은 보여주지 않아요.</PageHead>;

  if (error && !data) {
    return (
      <>
        {head}
        <StateMessage
          role="alert"
          message={error}
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={reload}>
              다시 불러오기
            </button>
          }
        />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {head}
        <StateMessage message="접근 로그를 불러오는 중이에요." />
      </>
    );
  }

  return (
    <>
      {head}
      <div className="toolbar">
        <span aria-live="polite">전체 {data.totalElements}건</span>
        <button type="button" className="btn btn--quiet btn--sm" onClick={reload} disabled={loading}>
          {loading ? '불러오는 중이에요' : '다시 불러오기'}
        </button>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {data.items.length === 0 ? (
        <StateMessage message="기록된 접근 로그가 아직 없어요." />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table table--compact">
            <caption className="visually-hidden">접근 로그</caption>
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
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.actorUserId === null ? <span className="tag tag--plain">로그인 안 함</span> : `#${log.actorUserId}`}</td>
                  <td>{LOG_ACTION_LABEL[log.action] ?? log.action}</td>
                  <td>
                    {LOG_RESOURCE_LABEL[log.resourceType] ?? log.resourceType}
                    {log.resourceId === null ? '' : ` #${log.resourceId}`}
                  </td>
                  <td>
                    <span className={`tag ${log.result === 'SUCCESS' ? '' : 'tag--alert'}`}>
                      {log.result === 'SUCCESS' ? '성공' : log.result === 'DENIED' ? '거부·실패' : log.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totalPages > 1 ? (
        <nav className="toolbar pager" aria-label="쪽 이동">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
            이전 쪽
          </button>
          <span>
            {data.page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= data.totalPages || loading}
          >
            다음 쪽
          </button>
        </nav>
      ) : null}
    </>
  );
}
