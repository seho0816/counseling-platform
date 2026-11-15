import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeApiError } from '../../api/http';
import { fetchIntakes } from '../../api/remoteIntakeApi';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import { INTAKE_STATUS_LABEL } from '../../constants/labels';
import type { ApiIntakePage } from '../../types';
import { truncate } from '../../utils/format';
import { formatDateTime } from '../../utils/schedule';

const PAGE_SIZE = 20;
type Filter = '' | 'SUBMITTED' | 'PROCESSED';

/** 상담 신청 목록(GET /api/admin/intakes) — 관리자 전용. 접수된 신청서를 확인하고 사례로 전환한다. */
export default function IntakeListPage() {
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApiIntakePage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchIntakes(page, PAGE_SIZE, filter || undefined)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(describeApiError(e, '상담 신청 목록을 불러오지 못했어요.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const head = <PageHead title="상담 신청">비회원이 제출한 상담 신청서예요. 내용을 확인하고 상담 사례로 전환한 뒤 상담사를 배정해요.</PageHead>;

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
        <StateMessage message="상담 신청을 불러오는 중이에요." />
      </>
    );
  }

  return (
    <>
      {head}
      <div className="toolbar">
        <div className="chips" role="group" aria-label="상태 필터">
          {(
            [
              ['SUBMITTED', '접수됨'],
              ['PROCESSED', '처리됨'],
              ['', '전체'],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              className="chip"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <span aria-live="polite">전체 {data.totalElements}건</span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={reload} disabled={loading}>
            {loading ? '불러오는 중이에요' : '다시 불러오기'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {data.items.length === 0 ? (
        <StateMessage message={filter === 'SUBMITTED' ? '처리할 상담 신청이 없어요.' : '해당하는 상담 신청이 없어요.'} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table table--compact">
            <caption className="visually-hidden">상담 신청 목록</caption>
            <thead>
              <tr>
                <th scope="col">번호</th>
                <th scope="col">신청자</th>
                <th scope="col">분야</th>
                <th scope="col">고민</th>
                <th scope="col">상태</th>
                <th scope="col">신청일</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <th scope="row">
                    <Link to={`/admin/intakes/${i.id}`}>{i.applicantName}</Link>
                  </th>
                  <td>{i.concernCategory}</td>
                  <td className="cell-wrap">{truncate(i.concernDescription, 60)}</td>
                  <td>
                    <span className={`tag ${i.status === 'SUBMITTED' ? '' : 'tag--plain'}`}>{INTAKE_STATUS_LABEL[i.status] ?? i.status}</span>
                  </td>
                  <td>{formatDateTime(i.createdAt)}</td>
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
