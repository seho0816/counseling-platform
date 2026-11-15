import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { HOME_PATH } from './auth/paths';
import RequireRole from './auth/RequireRole';
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
import CounselorLayout from './layouts/CounselorLayout';
import MockNotice from './components/MockNotice';
import ApplyPage from './pages/ApplyPage';
import LoginPage from './pages/LoginPage';
import { ForbiddenPage, NotFoundPage } from './pages/MessagePage';
import AccountsPage from './pages/admin/AccountsPage';
import AccessLogsPage from './pages/admin/AccessLogsPage';
import IntakeDetailPage from './pages/admin/IntakeDetailPage';
import IntakeListPage from './pages/admin/IntakeListPage';
import AdminNewCasePage from './pages/admin/AdminNewCasePage';
import CaseDetailPage from './pages/counselor/CaseDetailPage';
import CaseListPage from './pages/counselor/CaseListPage';
import NewCasePage from './pages/counselor/NewCasePage';
import NewSessionPage from './pages/counselor/NewSessionPage';
import SessionPage from './pages/counselor/SessionPage';
import CounselorHome from './pages/counselor/CounselorHome';
import ChatbotPage from './pages/client/ChatbotPage';
import ClientHome from './pages/client/ClientHome';
import CounselorDetailPage from './pages/client/CounselorDetailPage';
import CounselorListPage from './pages/client/CounselorListPage';

/** 아직 서버 API에 연결하지 않은 화면: 위에 '가상 데이터' 안내를 붙인다. 연결을 마치면 이 래퍼를 뺀다. */
function Mock({ children }: { children: ReactNode }) {
  return (
    <>
      <MockNotice />
      {children}
    </>
  );
}

function RootRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') return null; // 서버 세션 확인이 끝나면 다시 그려진다
  return <Navigate to={user ? HOME_PATH[user.role] : '/login'} replace />;
}

/**
 * 화면 구조 (역할별로 레이아웃과 접근 권한을 나눈다)
 *
 * /login                                          로그인(상담사·내담자(가상)·관리자)  F-05-1
 * /apply                                          비회원 상담 신청(공개, 실제 API)    F-04-3
 * /counselor                                      상담사 홈(실제 API)                F-03
 * /counselor/cases(/:caseId)                      사례 목록·상세·상태 변경(실제 API)   F-03
 * /counselor/cases/:caseId/sessions/new           상담 기록 작성(실제 API)            F-01-2
 * /counselor/cases/:caseId/sessions/:sessionId    상담 기록과 AI 요약 검토·승인(실제)  F-02
 * /counselor/cases/new                            사례 등록(가상 데이터, 백엔드는 관리자만 허용) F-01-1
 * /client                                         내담자 홈(가상)
 * /client/chatbot, /client/counselors(...)        챗봇·상담사 찾기(가상 데이터)        F-04, X-01~X-03
 * /admin                                          → /admin/cases 로 이동
 * /admin/cases(/new, /:caseId)                   전체 사례 목록·등록·상세·배정·상태(실제 API)
 * /admin/intakes(/:id)                           상담 신청 목록·상세·사례 전환(실제 API)
 * /admin/logs                                     접근 로그(실제 API)                F-05-3
 * /admin/accounts                                 상담사 계정(실제 API)              F-05-1
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route element={<RequireRole roles={['counselor']} />}>
        <Route path="/counselor" element={<CounselorLayout />}>
          <Route index element={<CounselorHome />} />
          <Route path="cases" element={<CaseListPage />} />
          <Route path="cases/new" element={<Mock><NewCasePage /></Mock>} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="cases/:caseId/sessions/new" element={<NewSessionPage />} />
          <Route path="cases/:caseId/sessions/:sessionId" element={<SessionPage />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['client']} />}>
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<ClientHome />} />
          <Route path="chatbot" element={<Mock><ChatbotPage /></Mock>} />
          <Route path="counselors" element={<Mock><CounselorListPage /></Mock>} />
          <Route path="counselors/:counselorId" element={<Mock><CounselorDetailPage /></Mock>} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/cases" replace />} />
          <Route path="cases" element={<CaseListPage />} />
          <Route path="cases/new" element={<AdminNewCasePage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="intakes" element={<IntakeListPage />} />
          <Route path="intakes/:id" element={<IntakeDetailPage />} />
          <Route path="logs" element={<AccessLogsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
