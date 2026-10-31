import type { CaseStatus } from '../types';

export default function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className="badge" data-status={status}>
      {status}
    </span>
  );
}
