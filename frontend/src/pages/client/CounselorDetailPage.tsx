import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCounselor } from '../../api/counselorApi';
import StateMessage from '../../components/StateMessage';
import { METHOD_LABEL } from '../../constants/fields';
import type { Counselor } from '../../types';
import { formatDay, formatTime, nextSlots } from '../../utils/schedule';

export default function CounselorDetailPage() {
  const { counselorId = '' } = useParams();
  const [counselor, setCounselor] = useState<Counselor | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setCounselor(undefined);
    getCounselor(counselorId).then((data) => !cancelled && setCounselor(data));
    return () => {
      cancelled = true;
    };
  }, [counselorId]);

  const back = (
    <Link className="back-link" to="/client/counselors">
      상담사 목록으로 돌아가기
    </Link>
  );

  if (counselor === undefined) {
    return (
      <>
        {back}
        <StateMessage message="상담사 정보를 불러오는 중이에요." />
      </>
    );
  }

  if (counselor === null) {
    return (
      <>
        {back}
        <StateMessage role="alert" message="상담사를 찾을 수 없어요. 목록에서 다시 골라 주세요." />
      </>
    );
  }

  // 날짜별로 묶어서 보여준다
  const byDay = new Map<string, string[]>();
  nextSlots(counselor.availability, 12).forEach((slot) => {
    const key = formatDay(slot);
    byDay.set(key, [...(byDay.get(key) ?? []), formatTime(slot)]);
  });

  return (
    <>
      {back}
      <div className="detail">
        <header className="page-head">
          <h1>{counselor.name}</h1>
          <p>
            {counselor.title}, {counselor.organization}
          </p>
        </header>

        <section className="section" aria-label="소개">
          <ul className="tags" aria-label="주 상담 분야">
            {counselor.fields.map((f) => (
              <li key={f} className="tag">
                {f}
              </li>
            ))}
            {counselor.methods.map((m) => (
              <li key={m} className="tag tag--plain">
                {METHOD_LABEL[m]}
              </li>
            ))}
          </ul>
          <p className="detail__intro">{counselor.intro}</p>
        </section>

        <section className="section" aria-labelledby="slots-heading">
          <h2 id="slots-heading">2주 안에 가능한 시간</h2>
          {byDay.size === 0 ? (
            <StateMessage message="2주 안에 가능한 시간이 없어요. 다른 상담사를 살펴보세요." />
          ) : (
            <ul className="slot-days">
              {[...byDay.entries()].map(([day, times]) => (
                <li key={day}>
                  <strong>{day}</strong>
                  <span className="tags">
                    {times.map((t) => (
                      <span key={t} className="slot">
                        {t}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <button type="button" className="btn btn--primary" disabled>
            예약하기
          </button>
          <p className="field__hint detail__hint">
            예약 기능은 다음 단계에서 연결해요.
          </p>
        </section>
      </div>
    </>
  );
}
