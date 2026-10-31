import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HOME_PATH } from '../auth/paths';

interface Props {
  title: string;
  body: string;
}

function MessagePage({ title, body }: Props) {
  const { user } = useAuth();
  const to = user ? HOME_PATH[user.role] : '/login';
  return (
    <main className="center-screen">
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <Link className="btn btn--primary" to={to}>
        {user ? '내 첫 화면으로 가기' : '로그인 화면으로 가기'}
      </Link>
    </main>
  );
}

export function NotFoundPage() {
  return <MessagePage title="페이지를 찾을 수 없어요" body="주소가 바뀌었거나 없는 페이지예요. 첫 화면에서 다시 시작해 주세요." />;
}

export function ForbiddenPage() {
  return <MessagePage title="이 화면은 볼 수 없어요" body="현재 계정으로는 접근할 수 없는 화면이에요. 내 첫 화면에서 필요한 메뉴를 찾아 주세요." />;
}
