import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Brand from '../components/Brand';
import DevTools from '../components/DevTools';

/** 상담사 화면: 왼쪽 메뉴가 있는 업무용 구조. 담당 사례와 기록을 오가며 작업한다. */
export default function CounselorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="shell__side">
        <Brand to="/counselor" />
        <nav className="nav" aria-label="상담사 메뉴">
          <NavLink to="/counselor" end className="nav__link">
            홈
          </NavLink>
          <NavLink to="/counselor/cases" className="nav__link">
            사례 목록
          </NavLink>
        </nav>
        {import.meta.env.DEV ? <DevTools /> : null}
        <div className="side__user">
          <div>
            <strong>{user?.name}</strong>
            <span className="muted">상담사</span>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
