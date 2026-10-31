import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HOME_PATH } from '../auth/paths';
import Brand from '../components/Brand';
import { getDb } from '../mocks/db';

type Tab = 'counselor' | 'admin' | 'client';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'counselor', label: '상담사' },
  { id: 'client', label: '내담자' },
  { id: 'admin', label: '기관 관리자' },
];

export default function LoginPage() {
  const { user, loginStaff, enterClient } = useAuth();
  const location = useLocation();

  const [tab, setTab] = useState<Tab>('counselor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 이미 로그인했거나 방금 로그인했다면 역할에 맞는 첫 화면으로 보낸다.
  if (user) {
    const home = HOME_PATH[user.role];
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith(home) ? from : home} replace />;
  }

  const selectTab = (next: Tab) => {
    setTab(next);
    setError('');
    setPassword('');
  };

  const handleStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await loginStaff(email, password, tab as 'counselor' | 'admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  const handleClientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await enterClient(alias);
  };

  const demo = getDb().accounts.find((a) => a.role === tab);

  return (
    <div className="login">
      <section className="login__intro" aria-label="서비스 소개">
        <Brand to="/login" />
        <div className="login__headline">
          <h1>상담 기록은 간편하게, 신청 전 안내는 친절하게</h1>
          <p>AI는 상담을 대신하지 않고 안내와 기록 요약만 도와요. 요약은 상담사가 확인한 뒤에만 저장돼요.</p>
        </div>
        <dl className="login__roles">
          <div>
            <dt>상담사</dt>
            <dd>담당 사례의 기록을 요약하고 사례 상태를 관리해요.</dd>
          </div>
          <div>
            <dt>내담자</dt>
            <dd>기관과 프로그램을 안내받고 상담 신청을 준비해요.</dd>
          </div>
          <div>
            <dt>기관 관리자</dt>
            <dd>계정, 권한, 접근 기록을 확인해요.</dd>
          </div>
        </dl>
      </section>

      <section className="login__panel" aria-label="로그인">
        <div className="login__card">
          <div className="tabs" role="tablist" aria-label="이용 유형">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === t.id}
                aria-controls="login-form"
                onClick={() => selectTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'client' ? (
            <form id="login-form" className="form" role="tabpanel" aria-labelledby="tab-client" onSubmit={handleClientSubmit}>
              <p>내담자는 비밀번호 없이 신청 링크로 들어와요. 입력한 이름은 가명으로만 쓰여요.</p>
              <div className="field">
                <label className="field__label" htmlFor="alias">
                  사용할 이름(가명)
                </label>
                <input
                  id="alias"
                  className="field__input"
                  autoComplete="off"
                  placeholder="예: 하늘"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
                <span className="field__hint">비워 두면 &lsquo;방문자&rsquo;로 들어가요.</span>
              </div>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? '입장하는 중이에요' : '상담 신청 시작하기'}
              </button>
            </form>
          ) : (
            <form
              id="login-form"
              className="form"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              onSubmit={handleStaffSubmit}
              noValidate
            >
              <div className="field">
                <label className="field__label" htmlFor="email">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  className="field__input"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="password">
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  className="field__input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? '로그인하는 중이에요' : '로그인'}
              </button>

              {import.meta.env.DEV && demo ? (
                <div className="dev-hint">
                  <span>개발용 계정(실제 서비스에서는 사라져요)</span>
                  <code>{demo.email}</code>
                  <code>{demo.password}</code>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword(demo.password);
                    }}
                  >
                    계정 정보 입력하기
                  </button>
                </div>
              ) : null}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
