import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, describeApiError } from '../../api/http';
import { assignCase, counselorLabel, fetchCounselors } from '../../api/remoteAdminApi';
import { caseFromApi, fetchCase } from '../../api/remoteCaseApi';
import { useAuth } from '../../auth/AuthContext';
import ConfirmInline from '../../components/ConfirmInline';
import PageHead from '../../components/PageHead';
import Placeholder from '../../components/Placeholder';
import StateMessage from '../../components/StateMessage';
import StatusBadge from '../../components/StatusBadge';
import type { ApiCounselorAccount, CaseRow } from '../../types';
import { formatDateTime } from '../../utils/schedule';

/**
 * 사례 상세 — GET /api/cases/{id} 를 그대로 보여준다.
 * 관리자는 여기서 상담사를 배정·해제한다(PATCH /api/admin/cases/{id}/assignment).
 * 회기 기록·AI 요약은 백엔드 API가 아직 없어서 자리만 두었다.
 */
export default function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const listPath = isAdmin ? '/admin/cases' : '/counselor/cases';

  const id = Number(caseId);
  const validId = Number.isInteger(id) && id > 0;

  const [item, setItem] = useState<CaseRow | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [loading, setLoading] = useState(validId);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState(
    (location.state as { created?: boolean } | null)?.created ? '사례를 등록했어요.' : '',
  );

  // 관리자 전용: 상담사 목록과 배정 선택
  const [counselors, setCounselors] = useState<ApiCounselorAccount[]>([]);
  const [counselorError, setCounselorError] = useState('');
  const [selected, setSelected] = useState('');
  const [askUnassign, setAskUnassign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCase(id)
      .then((row) => {
        if (cancelled) return;
        setItem(row);
        setSelected(row.counselorId === null ? '' : String(row.counselorId));
      })
      .catch((e) => {
        if (cancelled) return;
        const notFound = e instanceof ApiError && e.status === 404;
        setItem(null);
        setError({
          notFound,
          message: notFound
            ? isAdmin
              ? '이 사례를 찾을 수 없어요. 없는 사례예요.'
              : '이 사례를 열 수 없어요. 없는 사례이거나 내게 배정된 사례가 아니에요.'
            : describeApiError(e, '사례를 불러오지 못했어요.'),
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, validId, isAdmin, reloadKey]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setCounselorError('');
    fetchCounselors()
      .then((list) => !cancelled && setCounselors(list))
      .catch((e) => !cancelled && setCounselorError(describeApiError(e, '상담사 목록을 불러오지 못했어요.')));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  const names = Object.fromEntries(counselors.map((c) => [c.id, c.name])) as Record<number, string>;

  const saveAssignment = async () => {
    if (!item) return;
    const counselorId = selected === '' ? null : Number(selected);
    setAssigning(true);
    setAssignError('');
    try {
      const updated = caseFromApi(await assignCase(item.id, counselorId));
      setItem(updated);
      setSelected(updated.counselorId === null ? '' : String(updated.counselorId));
      setNotice(counselorId === null ? '배정을 해제했어요.' : '상담사를 배정했어요.');
      setAskUnassign(false);
    } catch (e) {
      setAskUnassign(false);
      if (e instanceof ApiError && e.status === 400) {
        setAssignError('이 상담사는 배정할 수 없어요. 사용 중인 상담사 계정만 배정할 수 있어요.');
      } else if (e instanceof ApiError && e.status === 404) {
        setAssignError('사례나 상담사를 찾을 수 없어요. 목록을 다시 불러온 뒤 시도해 주세요.');
      } else {
        setAssignError(describeApiError(e, '배정하지 못했어요.'));
      }
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveClick = () => {
    // 이미 배정된 사례의 배정을 푸는 것은 한 번 더 확인한다.
    if (selected === '' && item?.counselorId !== null) setAskUnassign(true);
    else void saveAssignment();
  };

  const back = (
    <Link className="back-link" to={listPath}>
      사례 목록으로 돌아가기
    </Link>
  );

  if (!validId) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="주소의 사례 번호가 올바르지 않아요." />
      </>
    );
  }

  if (error) {
    return (
      <>
        {back}
        <StateMessage
          role="alert"
          message={error.message}
          action={
            error.notFound ? undefined : (
              <button type="button" className="btn btn--quiet btn--sm" onClick={reload}>
                다시 불러오기
              </button>
            )
          }
        />
      </>
    );
  }

  if (!item || loading) {
    return (
      <>
        {back}
        <StateMessage message="사례를 불러오는 중이에요." />
      </>
    );
  }

  const unchanged = selected === (item.counselorId === null ? '' : String(item.counselorId));

  return (
    <>
      {back}
      <PageHead title={item.alias}>{item.title}</PageHead>

      {notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="section" aria-labelledby="basic-heading">
        <div className="section__head">
          <h2 id="basic-heading">사례 정보</h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={reload}>
            다시 불러오기
          </button>
        </div>
        <dl className="panel kv">
          <div>
            <dt>사례 번호</dt>
            <dd>{item.id}</dd>
          </div>
          <div>
            <dt>이름(가명)</dt>
            <dd>{item.alias}</dd>
          </div>
          <div>
            <dt>내담자 번호</dt>
            <dd>{item.clientId}</dd>
          </div>
          <div>
            <dt>연령대</dt>
            <dd>{item.ageGroup ?? '-'}</dd>
          </div>
          <div>
            <dt>고민</dt>
            <dd>{item.concern ?? '-'}</dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd>{item.status ? <StatusBadge status={item.status} /> : item.statusRaw}</dd>
          </div>
          {isAdmin ? (
            <div>
              <dt>담당 상담사</dt>
              <dd>
                {item.counselorId === null ? (
                  <span className="tag tag--plain">미배정</span>
                ) : (
                  counselorLabel(names, item.counselorId)
                )}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>등록</dt>
            <dd>{formatDateTime(item.createdAt)}</dd>
          </div>
          <div>
            <dt>최근 수정</dt>
            <dd>{item.updatedAt ? formatDateTime(item.updatedAt) : '-'}</dd>
          </div>
        </dl>
      </section>

      {isAdmin ? (
        <section className="section" aria-labelledby="assign-heading">
          <h2 id="assign-heading">상담사 배정</h2>
          <div className="panel stack">
            <div className="field">
              <label className="field__label" htmlFor="assign-select">
                담당 상담사
              </label>
              <select
                id="assign-select"
                className="field__input"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setAskUnassign(false);
                  setAssignError('');
                }}
                disabled={assigning}
              >
                <option value="">미배정</option>
                {counselors.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.active}>
                    {c.name} (#{c.id}){c.active ? '' : ' - 사용 중지'}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                {counselorError
                  ? `${counselorError} 상담사 목록이 없으면 배정할 수 없어요.`
                  : '사용 중인 상담사만 선택할 수 있어요. \u2018미배정\u2019을 고르면 배정을 해제해요.'}
              </span>
            </div>

            {assignError ? (
              <p className="form-error" role="alert">
                {assignError}
              </p>
            ) : null}

            {askUnassign ? (
              <ConfirmInline
                message="배정을 해제하면 담당 상담사가 이 사례를 볼 수 없어요. 해제할까요?"
                confirmLabel="배정 해제"
                busy={assigning}
                onConfirm={() => void saveAssignment()}
                onCancel={() => {
                  setAskUnassign(false);
                  setSelected(item.counselorId === null ? '' : String(item.counselorId));
                }}
              />
            ) : (
              <div className="actions">
                <button type="button" className="btn btn--primary btn--sm" onClick={handleSaveClick} disabled={unchanged || assigning}>
                  {assigning ? '저장하는 중이에요' : '배정 저장'}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="section" aria-label="회기 기록과 AI 요약">
        <Placeholder
          title="회기 기록과 AI 요약"
          summary="서버에 회기·요약 API가 만들어지면 이 자리에 연결해요."
          items={['회기 이력과 상담 기록', 'AI 요약 초안 검토·수정·확정', '사례 상태 변경']}
          requirementIds={['F-01-2', 'F-02', 'F-03']}
        />
      </section>
    </>
  );
}
