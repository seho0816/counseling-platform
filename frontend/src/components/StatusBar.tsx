import type { CaseStatus, CounselingCase } from '../types';
import StatusBadge from './StatusBadge';

const ORDER: CaseStatus[] = ['접수', '진행', '종결', '연계'];

/** 사례 상태별 건수를 한 줄 막대와 범례로 보여준다. (F-03) */
export default function StatusBar({ cases }: { cases: CounselingCase[] }) {
  const counts = ORDER.map((status) => ({ status, count: cases.filter((c) => c.status === status).length }));
  const summary = counts.map((c) => `${c.status} ${c.count}건`).join(', ');

  return (
    <div>
      <div className="statusbar" role="img" aria-label={`사례 상태: ${summary}`}>
        {counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.status} data-status={c.status} style={{ flex: `${c.count} 1 0` }} />
          ))}
      </div>
      <ul className="legend">
        {counts.map((c) => (
          <li key={c.status}>
            <StatusBadge status={c.status} />
            <span className="legend__count">
              <strong>{c.count}</strong>
              <span className="muted">건</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
