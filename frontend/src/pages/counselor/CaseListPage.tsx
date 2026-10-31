import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../../api/caseApi';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import { SUMMARY_LABEL } from '../../constants/labels';
import type { CaseStatus, CounselingCase } from '../../types';
import { formatRelativeDay } from '../../utils/schedule';

const STATUSES: Array<CaseStatus | 'all'> = ['all', '접수', '진행', '종결', '연계'];

export default function CaseListPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CounselingCase[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<CaseStatus | 'all'>('all');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listCases(user)
      .then((data) => !cancelled && setCases(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visible = (cases ?? []).filter((c) => status === 'all' || c.status === status);
  const countOf = (s: CaseStatus | 'all') => (cases ?? []).filter((c) => s === 'all' || c.status === s).length;

  return (
    <>
      <PageHead title="사례 목록">내가 담당하는 사례만 보여요. 사례를 열면 회기 이력과 요약을 볼 수 있어요.</PageHead>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="상태로 거르기">
          {STATUSES.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'all' ? '전체' : s} {cases ? countOf(s) : ''}
            </button>
          ))}
        </div>
        <Link className="btn btn--primary btn--sm" to="/counselor/cases/new">
          새 사례 등록
        </Link>
      </div>

      {failed ? (
        <StateMessage role="alert" message="사례를 불러오지 못했어요. 페이지를 새로 고쳐 주세요." />
      ) : cases === null ? (
        <StateMessage message="사례를 불러오는 중이에요." />
      ) : cases.length === 0 ? (
        <StateMessage
          message="담당 사례가 아직 없어요. 내담자가 챗봇으로 신청하거나 직접 등록하면 접수 상태로 나타나요."
          action={
            <Link className="btn btn--primary btn--sm" to="/counselor/cases/new">
              새 사례 등록
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <StateMessage message={`\u2018${status}\u2019 상태인 사례가 없어요.`} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">담당 사례 목록</caption>
            <thead>
              <tr>
                <th scope="col">이름(가명)</th>
                <th scope="col">상태</th>
                <th scope="col">회기</th>
                <th scope="col">최근 상담</th>
                <th scope="col">요약</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link to={`/counselor/cases/${c.id}`}>{c.clientAlias}</Link>{' '}
                    {c.crisisFlag ? <span className="tag tag--alert">위기 표시</span> : null}{' '}
                    {c.source === '챗봇 접수' ? <span className="tag tag--plain">챗봇 접수</span> : null}
                  </th>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.sessionCount}회</td>
                  <td>{formatRelativeDay(c.lastSessionAt)}</td>
                  <td>{SUMMARY_LABEL[c.summaryState]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
