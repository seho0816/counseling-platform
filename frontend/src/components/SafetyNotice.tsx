import { CRISIS_NOTICE } from '../constants/crisis';

/** 위기 안내. AI가 만든 문장이 아니라 미리 정한 고정 문구만 쓴다. */
export default function SafetyNotice() {
  return (
    <aside className="safety" aria-label="안전 안내">
      <strong>도움이 필요하면 지금 연락해 주세요.</strong> {CRISIS_NOTICE.message} {CRISIS_NOTICE.hotlineName}{' '}
      <a href={`tel:${CRISIS_NOTICE.hotlineNumber}`}>{CRISIS_NOTICE.hotlineNumber}</a>. 이 서비스의 챗봇은 상담을 대신하지 않고
      안내와 접수만 도와요.
    </aside>
  );
}
