import { Link } from 'react-router-dom';
import { METHOD_LABEL } from '../constants/fields';
import type { Counselor } from '../types';
import { formatSlot, nextSlots } from '../utils/schedule';

/** 상담사 한 명의 요약. 주 상담 분야와 가까운 가능 시간을 먼저 보여준다. (X-01, X-03) */
export default function CounselorCard({ counselor }: { counselor: Counselor }) {
  const slots = nextSlots(counselor.availability, 3);

  return (
    <article className="counselor">
      <div className="counselor__mono" aria-hidden="true">
        {counselor.name.charAt(0)}
      </div>

      <div className="counselor__body">
        <div className="counselor__name">
          <h3>{counselor.name}</h3>
          <span className="muted">{counselor.title}</span>
          <span className="muted">{counselor.organization}</span>
        </div>

        <ul className="tags" aria-label="주 상담 분야">
          {counselor.fields.map((field) => (
            <li key={field} className="tag">
              {field}
            </li>
          ))}
        </ul>

        <p className="counselor__intro">{counselor.intro}</p>

        <ul className="tags" aria-label="상담 방식">
          {counselor.methods.map((method) => (
            <li key={method} className="tag tag--plain">
              {METHOD_LABEL[method]}
            </li>
          ))}
        </ul>

        <div className="counselor__slots">
          <span>가까운 가능 시간</span>
          {slots.length > 0 ? (
            slots.map((slot) => (
              <span key={slot.toISOString()} className="slot">
                {formatSlot(slot)}
              </span>
            ))
          ) : (
            <span>2주 안에 가능한 시간이 없어요</span>
          )}
        </div>
      </div>

      <Link
        className="btn btn--quiet counselor__action"
        to={`/client/counselors/${counselor.id}`}
        aria-label={`${counselor.name} 상담사 일정 보기`}
      >
        일정 보기
      </Link>
    </article>
  );
}
