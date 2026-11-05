import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { enterAsClient, loginWithPassword, logoutFromServer, restoreSession } from '../api/authApi';
import { setUnauthorizedHandler } from '../api/http';
import type { User } from '../types';

/**
 * 로그인 상태.
 * - 상담사·관리자: 서버 세션(JSESSIONID)이 기준이다. 앱을 열 때 GET /api/auth/me 로 확인한다.
 *   브라우저에는 사용자 정보를 저장하지 않는다.
 * - 내담자: 백엔드 로그인이 아직 없어서 화면 안에서만 쓰는 가상 입장이다(sessionStorage).
 */
const CLIENT_KEY = 'mindnote.client';

/** loading: 서버 세션을 확인하는 중. 이 동안에는 화면을 보내거나 막지 않는다. */
export type AuthStatus = 'loading' | 'ready';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  loginStaff: (email: string, password: string, expectedRole?: 'counselor' | 'admin') => Promise<User>;
  enterClient: (alias: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readClient(): User | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeClient(user: User | null) {
  try {
    if (user) sessionStorage.setItem(CLIENT_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CLIENT_KEY);
  } catch {
    /* 저장소를 쓸 수 없어도 이번 접속 동안은 동작한다 */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialClient = useMemo(readClient, []);
  const [user, setUser] = useState<User | null>(initialClient);
  const [status, setStatus] = useState<AuthStatus>(initialClient ? 'ready' : 'loading');

  // 앱을 열 때 서버 세션 확인 (내담자 가상 입장 상태가 있으면 건너뜀)
  useEffect(() => {
    if (initialClient) return;
    let cancelled = false;
    restoreSession()
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && setUser(null)) // 서버가 꺼져 있어도 로그인 화면은 보여준다
      .finally(() => !cancelled && setStatus('ready'));
    return () => {
      cancelled = true;
    };
  }, [initialClient]);

  // 다른 API 요청에서 401이 오면(세션 만료) 로그인 상태를 푼다.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser((current) => (current?.role === 'client' ? current : null)));
    return () => setUnauthorizedHandler(null);
  }, []);

  const loginStaff = useCallback<AuthContextValue['loginStaff']>(async (email, password, expectedRole) => {
    const next = await loginWithPassword(email, password);
    if (expectedRole && next.role !== expectedRole) {
      // 선택한 탭과 계정 역할이 다르면 방금 만든 세션을 바로 끊는다.
      await logoutFromServer();
      throw new Error(
        expectedRole === 'admin'
          ? '관리자 계정이 아니에요. \u2018상담사\u2019 탭에서 로그인해 주세요.'
          : '상담사 계정이 아니에요. \u2018기관 관리자\u2019 탭에서 로그인해 주세요.',
      );
    }
    writeClient(null);
    setUser(next);
    return next;
  }, []);

  const enterClient = useCallback<AuthContextValue['enterClient']>(async (alias) => {
    const next = await enterAsClient(alias);
    writeClient(next);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    if (user?.role !== 'client') await logoutFromServer();
    writeClient(null);
    setUser(null);
  }, [user]);

  const value = useMemo(
    () => ({ user, status, loginStaff, enterClient, logout }),
    [user, status, loginStaff, enterClient, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
