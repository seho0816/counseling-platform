import type { SummaryStatus } from '../types';

const LABEL: Record<SummaryStatus | 'none', string> = {
  none: '요약 없음',
  draft: '검토 필요',
  confirmed: '확정',
};

export default function SummaryBadge({ status }: { status: SummaryStatus | 'none' }) {
  return <span className={`tag${status === 'confirmed' ? '' : ' tag--plain'}`}>{LABEL[status]}</span>;
}
