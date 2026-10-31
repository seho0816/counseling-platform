import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../../api/caseApi';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import StatusBar from '../../components/StatusBar';
import type { CounselingCase } from '../../types';
import { formatRelativeDay } from '../../utils/schedule';

export default function CounselorHome() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CounselingCase[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFailed(false);
    listCases(user)
      .then((data) => !cancelled && setCases(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user, retry]);

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  // 먼저 확인할 사례: 위기 표시 → 요약 검토·작성이 필요한 사례 순서
  const attention = (cases ?? [])
    .filter((c) => c.crisisFlag || c.summaryState === 'draft' || c.summaryState === 'missing')
    .sort((a, b) => Number(b.crisisFlag) - Number(a.crisisFlag));

  return (
    <>
      <PageHead title={`안녕하세요, ${user?.name} 님`}>오늘은 {today}이에요. 담당 사례 현황과 먼저 확인할 사례를 모았어요.</PageHead>

      {failed ? (
        <StateMessage
          role="alert"
          message="사례를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </button>
          }
        />
      ) : cases === null ? (
        <StateMessage message="담당 사례를 불러오는 중이에요." />
      ) : (
        <>
          <section className="section" aria-labelledby="status-heading">
            <div className="section__head">
              <h2 id="status-heading">담당 사례 {cases.length}건의 상태</h2>
              <Link className="btn btn--primary btn--sm" to="/counselor/cases/new">
                새 사례 등록
              </Link>
            </div>
            <StatusBar cases={cases} />
          </section>

          <section className="section" aria-labelledby="attention-heading">
            <h2 id="attention-heading">먼저 확인할 사례</h2>
            {attention.length === 0 ? (
              <StateMessage message="지금 확인할 사례가 없어요. 새 접수나 요약 초안이 생기면 여기에 나타나요." />
            ) : (
              <ul className="list">
                {attention.map((c) => (
                  <li key={c.id} className="list__item">
                    <div>
                      <p className="list__title">{c.clientAlias}</p>
                      <div className="list__meta">
                        <StatusBadge status={c.status} />
                        <span>최근 상담 {formatRelativeDay(c.lastSessionAt)}</span>
                        {c.crisisFlag ? <span className="tag tag--alert">위기 표시</span> : null}
                        {c.source === '챗봇 접수' && c.status === '접수' ? <span className="tag">챗봇 접수</span> : null}
                        {c.summaryState === 'draft' ? <span className="tag">요약 검토 필요</span> : null}
                        {c.summaryState === 'missing' ? <span className="tag tag--plain">요약 작성 필요</span> : null}
                      </div>
                    </div>
                    <Link className="btn btn--quiet btn--sm" to={`/counselor/cases/${c.id}`} aria-label={`${c.clientAlias} 사례 열기`}>
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
