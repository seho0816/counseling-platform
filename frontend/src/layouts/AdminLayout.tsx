import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Brand from '../components/Brand';

/** 기관 관리자 화면: 계정·권한·접근 로그를 다룬다. */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Brand to="/admin" />
          <nav className="topbar__nav" aria-label="관리자 메뉴">
            <NavLink to="/admin" end className="topbar__link">
              접근 로그
            </NavLink>
            <NavLink to="/admin/accounts" className="topbar__link">
              계정·권한
            </NavLink>
          </nav>
          <div className="topbar__user">
            <span>{user?.name}</span>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
