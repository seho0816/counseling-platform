import type { Role } from '../types';

export const HOME_PATH: Record<Role, string> = {
  counselor: '/counselor',
  admin: '/admin/cases', // 실제 API로 연결된 전체 사례 목록
  client: '/client',
};
