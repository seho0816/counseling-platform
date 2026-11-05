import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCases, type CasePage } from '../../api/remoteCaseApi';
import { describeApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import StatusBar from '../../components/StatusBar';
import { formatDateTime } from '../../utils/schedule';

const SAMPLE = 50; // 백엔드가 한 번에 줄 수 있는 최대 건수

/** 상담사 홈 — 배정된 사례의 상태 현황을 실제 API(GET /api/cases)로 보여준다. */
export default function CounselorHome() {
  const { user } = useAuth();
  const [data, setData] = useState<CasePage | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetchCases(0, SAMPLE)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(describeApiError(e, '사례를 불러오지 못했어요.')));
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  // 새로 접수되어 아직 상담을 시작하지 않은 사례를 먼저 보여준다.
  const received = (data?.items ?? []).filter((c) => c.status === '접수');

  return (
    <>
      <PageHead title={`안녕하세요, ${user?.name} 님`}>오늘은 {today}이에요. 내게 배정된 사례의 현황이에요.</PageHead>

      {error ? (
        <StateMessage
          role="alert"
          message={error}
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </button>
          }
        />
      ) : data === null ? (
        <StateMessage message="담당 사례를 불러오는 중이에요." />
      ) : (
        <>
          <section className="section" aria-labelledby="status-heading">
            <h2 id="status-heading">담당 사례 {data.totalElements}건의 상태</h2>
            <StatusBar cases={data.items} />
            {data.totalElements > data.items.length ? (
              <p className="field__hint">최근 {data.items.length}건 기준이에요.</p>
            ) : null}
          </section>

          <section className="section" aria-labelledby="attention-heading">
            <h2 id="attention-heading">새로 접수된 사례</h2>
            {received.length === 0 ? (
              <StateMessage message="새로 접수된 사례가 없어요. 접수 상태의 사례가 생기면 여기에 나타나요." />
            ) : (
              <ul className="list">
                {received.map((c) => (
                  <li key={c.id} className="list__item">
                    <div>
                      <p className="list__title">{c.alias}</p>
                      <div className="list__meta">
                        <StatusBadge status="접수" />
                        <span>{c.title}</span>
                        <span>등록 {formatDateTime(c.createdAt)}</span>
                      </div>
                    </div>
                    <Link className="btn btn--quiet btn--sm" to={`/counselor/cases/${c.id}`} aria-label={`${c.alias} 사례 열기`}>
                      사례 열기
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
