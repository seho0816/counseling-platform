const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 예: 11/18(수) 14:00 */
export function formatSlot(date: Date): string {
  return `${formatDay(date)} ${formatTime(date)}`;
}

/** 예: 11/18(수) */
export function formatDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}(${DAY_LABEL[date.getDay()]})`;
}

/** 예: 14:00 */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 예: 11/18(수) 14:00 (ISO 문자열에서) */
export function formatDateTime(iso: string): string {
  return formatSlot(new Date(iso));
}
