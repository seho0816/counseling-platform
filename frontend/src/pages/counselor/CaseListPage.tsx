import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { counselorLabel, fetchCounselorNames } from '../../api/remoteAdminApi';
import { fetchCases, type CasePage } from '../../api/remoteCaseApi';
import { describeApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime } from '../../utils/schedule';

const PAGE_SIZE = 20;

/**
 * 사례 목록 — Spring Boot의 GET /api/cases 를 그대로 보여준다.
 * 관리자는 전체 사례, 상담사는 본인에게 배정된 사례만 받는다(백엔드가 거른다).
 * 이름을 누르면 사례 상세(GET /api/cases/{id})로 이동한다.
 */
export default function CaseListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const basePath = isAdmin ? '/admin/cases' : '/counselor/cases';

  const [page, setPage] = useState(0);
  const [data, setData] = useState<CasePage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchCases(page, PAGE_SIZE)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(describeApiError(e, '사례 목록을 불러오지 못했어요.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  // 관리자는 상담사 번호 대신 이름을 보여주기 위해 상담사 목록을 함께 받는다(실패하면 번호만 표시).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetchCounselorNames().then((map) => !cancelled && setNames(map));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const head = (
    <PageHead title={isAdmin ? '전체 사례 목록' : '사례 목록'}>
      {isAdmin
        ? '관리자는 모든 사례를 볼 수 있어요. 서버(Spring Boot)에 저장된 실제 데이터예요.'
        : '내게 배정된 사례만 보여요. 서버(Spring Boot)에 저장된 실제 데이터예요.'}
    </PageHead>
  );

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
        <StateMessage message="사례를 불러오는 중이에요." />
      </>
    );
  }

  return (
    <>
      {head}

      <div className="toolbar">
        <p aria-live="polite">
          전체 {data.totalElements}건
          {data.totalPages > 1 ? `, ${data.page + 1}/${data.totalPages}쪽` : ''}
        </p>
        <div className="actions">
          {isAdmin ? (
            <Link className="btn btn--primary btn--sm" to="/admin/cases/new">
              새 사례 등록
            </Link>
          ) : null}
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
        <StateMessage
          message={
            isAdmin
              ? '등록된 사례가 아직 없어요. 위의 \'새 사례 등록\'으로 만들어 보세요.'
              : '내게 배정된 사례가 아직 없어요. 관리자가 사례를 배정하면 여기에 나타나요.'
          }
        />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table table--compact">
            <caption className="visually-hidden">상담 사례 목록</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">이름(가명)</th>
                <th scope="col">연령대</th>
                <th scope="col">제목</th>
                <th scope="col">고민</th>
                <th scope="col">상태</th>
                {isAdmin ? <th scope="col">담당 상담사</th> : null}
                <th scope="col">등록</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <th scope="row">
                    <Link to={`${basePath}/${c.id}`}>{c.alias}</Link>
                  </th>
                  <td>{c.ageGroup ?? '-'}</td>
                  <td className="cell-wrap">{c.title}</td>
                  <td className="cell-wrap">{c.concern ?? '-'}</td>
                  <td>{c.status ? <StatusBadge status={c.status} /> : <span className="tag tag--plain">{c.statusRaw}</span>}</td>
                  {isAdmin ? (
                    <td>{c.counselorId === null ? <span className="tag tag--plain">미배정</span> : counselorLabel(names, c.counselorId)}</td>
                  ) : null}
                  <td>{formatDateTime(c.createdAt)}</td>
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

      <p className="field__hint">이름을 누르면 사례 상세를 볼 수 있어요. 회기 기록·AI 요약은 서버 API가 만들어지면 연결해요.</p>
    </>
  );
}
