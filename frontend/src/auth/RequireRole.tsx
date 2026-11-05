import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../types';
import { useAuth } from './AuthContext';

/**
 * 화면 접근 가드. 역할이 맞지 않으면 화면을 보여주지 않는다. (F-05-2의 화면 쪽 대응)
 * 데이터 접근의 최종 권한 검사는 백엔드가 맡으므로, 이 가드는 사용성을 위한 1차 방어선이다.
 */
export default function RequireRole({ roles }: { roles: Role[] }) {
  const { user, status } = useAuth();
  const location = useLocation();

  // 서버 세션을 확인하는 동안에는 로그인 화면으로 보내지 않는다(새로고침 때 깜빡임 방지).
  if (status === 'loading') {
    return (
      <main className="center-screen" role="status">
        <p className="muted">로그인 상태를 확인하는 중이에요.</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
