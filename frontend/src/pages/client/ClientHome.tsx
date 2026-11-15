import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function ClientHome() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <h1>상담 신청, 천천히 시작해도 괜찮아요</h1>
        <p>{user?.name} 님, 궁금한 것부터 물어보거나 바로 상담을 신청할 수 있어요.</p>
      </section>

      <nav className="paths" aria-label="시작하기">
        <Link className="path" to="/client/chatbot">
          <strong>챗봇으로 안내받기</strong>
          <span>기관과 프로그램, 신청 절차를 알려드리고 초기 질문지 작성을 도와요.</span>
        </Link>
        <Link className="path" to="/apply">
          <strong>상담 신청서 바로 작성하기</strong>
          <span>이름(별칭)과 고민을 적고 개인정보 동의를 확인하면 신청이 접수돼요.</span>
        </Link>
      </nav>
    </>
  );
}
