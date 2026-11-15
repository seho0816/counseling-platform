import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, describeApiError } from '../../api/http';
import { convertIntake, describeConvertError, fetchIntake } from '../../api/remoteIntakeApi';
import ConfirmInline from '../../components/ConfirmInline';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import { INTAKE_STATUS_LABEL } from '../../constants/labels';
import type { ApiIntake } from '../../types';
import { formatDateTime } from '../../utils/schedule';

/** 상담 신청 상세(GET /api/admin/intakes/{id})와 사례로 전환(POST …/convert) — 관리자 전용 */
export default function IntakeDetailPage() {
  const { id: idParam = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(idParam);
  const validId = Number.isInteger(id) && id > 0;

  const [intake, setIntake] = useState<ApiIntake | null>(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setError('');
    fetchIntake(id)
      .then((row) => !cancelled && setIntake(row))
      .catch((e) =>
        !cancelled &&
        setError(e instanceof ApiError && e.status === 404 ? '신청서를 찾을 수 없어요.' : describeApiError(e, '신청서를 불러오지 못했어요.')),
      );
    return () => {
      cancelled = true;
    };
  }, [id, validId, reloadKey]);

  const back = (
    <Link className="back-link" to="/admin/intakes">
      상담 신청 목록으로 돌아가기
    </Link>
  );

  if (!validId) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="주소의 신청 번호가 올바르지 않아요." />
      </>
    );
  }
  if (error) {
    return (
      <>
        {back}
        <StateMessage role="alert" message={error} />
      </>
    );
  }
  if (!intake) {
    return (
      <>
        {back}
        <StateMessage message="신청서를 불러오는 중이에요." />
      </>
    );
  }

  const submitted = intake.status === 'SUBMITTED';

  const convert = async () => {
    setConverting(true);
    setConvertError('');
    try {
      const created = await convertIntake(intake.id);
      navigate(`/admin/cases/${created.id}`, { replace: true, state: { notice: '상담 신청을 사례로 전환했어요. 이제 상담사를 배정해 주세요.' } });
    } catch (e) {
      setAsking(false);
      setConvertError(describeConvertError(e));
      if (e instanceof ApiError && e.status === 409) setReloadKey((n) => n + 1);
    } finally {
      setConverting(false);
    }
  };

  return (
    <>
      {back}
      <PageHead title={`상담 신청 #${intake.id}`}>
        {formatDateTime(intake.createdAt)}에 접수됐어요.
      </PageHead>

      <section className="section" aria-labelledby="intake-heading">
        <h2 id="intake-heading">신청 내용</h2>
        <dl className="panel kv">
          <div>
            <dt>상태</dt>
            <dd>
              <span className={`tag ${submitted ? '' : 'tag--plain'}`}>{INTAKE_STATUS_LABEL[intake.status] ?? intake.status}</span>
            </dd>
          </div>
          <div>
            <dt>신청자</dt>
            <dd>{intake.applicantName}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>{intake.applicantContact ?? '-'}</dd>
          </div>
          <div>
            <dt>상담 분야</dt>
            <dd>{intake.concernCategory}</dd>
          </div>
          <div>
            <dt>이전 상담 경험</dt>
            <dd>{intake.hasPriorCounseling === null ? '답하지 않음' : intake.hasPriorCounseling ? '있음' : '없음'}</dd>
          </div>
          <div>
            <dt>개인정보 동의</dt>
            <dd>{intake.privacyConsentAt ? `${formatDateTime(intake.privacyConsentAt)}에 동의` : '기록 없음'}</dd>
          </div>
        </dl>
        <h3 style={{ marginTop: 20 }}>고민 내용</h3>
        <p className="record-view">{intake.concernDescription}</p>
      </section>

      <section className="section" aria-labelledby="convert-heading">
        <h2 id="convert-heading">사례로 전환</h2>
        <div className="panel stack">
          {submitted ? (
            <>
              <p>전환하면 내담자 정보와 상담 사례(접수 상태, 상담사 미배정)가 만들어져요. 전환한 뒤에 사례 화면에서 상담사를 배정해 주세요.</p>
              {asking ? (
                <ConfirmInline
                  message="이 신청서를 상담 사례로 전환할까요? 전환한 신청서는 다시 전환할 수 없어요."
                  confirmLabel="사례로 전환"
                  busy={converting}
                  onConfirm={() => void convert()}
                  onCancel={() => setAsking(false)}
                />
              ) : (
                <div className="actions">
                  <button type="button" className="btn btn--primary" onClick={() => setAsking(true)}>
                    상담 사례로 전환
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="field__hint">이미 처리된 신청서예요. 사례 목록에서 전환된 사례를 확인할 수 있어요.</p>
          )}
          {convertError ? (
            <p className="form-error" role="alert">
              {convertError}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
