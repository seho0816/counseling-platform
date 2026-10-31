import type { WeeklySlot } from '../types';

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 주간 반복 가능 시간에서, 지금 이후 14일 안의 가까운 순서대로 count개를 돌려준다. */
export function nextSlots(availability: WeeklySlot[], count = 3, from: Date = new Date()): Date[] {
  const candidates: Date[] = [];
  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    for (const slot of availability) {
      if (slot.weekday !== day.getDay()) continue;
      const [hour, minute] = slot.time.split(':').map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      if (at.getTime() > from.getTime()) candidates.push(at);
    }
  }
  return candidates.sort((a, b) => a.getTime() - b.getTime()).slice(0, count);
}

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

/** 예: 오늘, 어제, 3일 전 */
export function formatRelativeDay(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '아직 없음';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  return `${diff}일 전`;
}

/** 예: 11/18(수) 14:00 (ISO 문자열에서) */
export function formatDateTime(iso: string): string {
  return formatSlot(new Date(iso));
}

/** <input type="datetime-local">에 넣는 값. 예: 2026-11-18T14:00 */
export function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
