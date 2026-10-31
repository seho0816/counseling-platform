import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Brand from '../components/Brand';
import SafetyNotice from '../components/SafetyNotice';

/** 내담자 화면: 상단 메뉴 하나와 넉넉한 한 단 구성. 모든 화면 아래에 안전 안내를 둔다. */
export default function ClientLayout() {
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
          <Brand to="/client" />
          <nav className="topbar__nav" aria-label="내담자 메뉴">
            <NavLink to="/client" end className="topbar__link">
              홈
            </NavLink>
            <NavLink to="/client/chatbot" className="topbar__link">
              챗봇 안내
            </NavLink>
            <NavLink to="/client/counselors" className="topbar__link">
              상담사 찾기
            </NavLink>
          </nav>
          <div className="topbar__user">
            <span>{user?.name} 님</span>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleLogout}>
              나가기
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <div className="page__footer">
        <SafetyNotice />
      </div>
    </>
  );
}
