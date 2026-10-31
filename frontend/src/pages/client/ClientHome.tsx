import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function ClientHome() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <h1>상담 신청, 천천히 시작해도 괜찮아요</h1>
        <p>{user?.name} 님, 궁금한 것부터 물어보거나 상담사를 먼저 살펴볼 수 있어요.</p>
      </section>

      <nav className="paths" aria-label="시작하기">
        <Link className="path" to="/client/chatbot">
          <strong>챗봇으로 안내받기</strong>
          <span>기관과 프로그램, 신청 절차를 알려드리고 초기 질문지 작성을 도와요.</span>
        </Link>
        <Link className="path" to="/client/counselors">
          <strong>상담사 찾기</strong>
          <span>주 상담 분야와 가능한 시간을 보고 나에게 맞는 상담사를 골라요.</span>
        </Link>
      </nav>
    </>
  );
}
