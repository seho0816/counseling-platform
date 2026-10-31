import { useEffect, useState } from 'react';
import { listCounselors, type CounselorFilter } from '../../api/counselorApi';
import CounselorCard from '../../components/CounselorCard';
import CounselorFilters from '../../components/CounselorFilters';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import type { Counselor } from '../../types';

const INITIAL_FILTER: CounselorFilter = { query: '', field: 'all', method: 'all' };

export default function CounselorListPage() {
  const [filter, setFilter] = useState<CounselorFilter>(INITIAL_FILTER);
  const [counselors, setCounselors] = useState<Counselor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    listCounselors(filter)
      .then((data) => {
        if (cancelled) return;
        setCounselors(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, retry]);

  const isFiltered = filter.query.trim() !== '' || filter.field !== 'all' || filter.method !== 'all';

  return (
    <>
      <PageHead title="상담사 찾기">주 상담 분야와 가능한 시간을 보고 나에게 맞는 상담사를 골라요.</PageHead>

      <CounselorFilters value={filter} onChange={setFilter} />

      {failed ? (
        <StateMessage
          role="alert"
          message="상담사 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </button>
          }
        />
      ) : counselors === null ? (
        <StateMessage message="상담사 목록을 불러오는 중이에요." />
      ) : (
        <div aria-busy={loading}>
          <div className="result-meta">
            <p aria-live="polite">상담사 {counselors.length}명</p>
            {isFiltered ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setFilter(INITIAL_FILTER)}>
                조건 지우기
              </button>
            ) : null}
          </div>

          {counselors.length === 0 ? (
            <StateMessage message="조건에 맞는 상담사가 없어요. 분야나 상담 방식을 바꾸거나 검색어를 줄여 보세요." />
          ) : (
            <div className="counselors">
              {counselors.map((c) => (
                <CounselorCard key={c.id} counselor={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
