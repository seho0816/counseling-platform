import { COUNSELORS } from '../mocks/counselors';
import { getDb } from '../mocks/db';
import type { ConsultMethod, Counselor, CounselingField } from '../types';
import { sleep } from './delay';

export interface CounselorFilter {
  query: string;
  field: CounselingField | 'all';
  method: ConsultMethod | 'all';
}

/** 사용이 중지된 계정의 상담사는 목록에서 뺀다. */
function activeCounselors(): Counselor[] {
  const accounts = getDb().accounts;
  return COUNSELORS.filter((c) => accounts.find((a) => a.id === c.id)?.active !== false);
}

/** 상담사 목록 조회 (X-01, X-03). 백엔드 연동 시 GET /counselors?query=&field=&method= 로 교체. */
export async function listCounselors(filter: CounselorFilter): Promise<Counselor[]> {
  await sleep(250);
  const q = filter.query.trim().toLowerCase();
  return activeCounselors().filter((c) => {
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.intro.toLowerCase().includes(q) ||
      c.organization.toLowerCase().includes(q);
    const matchesField = filter.field === 'all' || c.fields.includes(filter.field);
    const matchesMethod = filter.method === 'all' || c.methods.includes(filter.method);
    return matchesQuery && matchesField && matchesMethod;
  });
}

export async function getCounselor(id: string): Promise<Counselor | null> {
  await sleep(200);
  return activeCounselors().find((c) => c.id === id) ?? null;
}
