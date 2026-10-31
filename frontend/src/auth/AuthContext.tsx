import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { enterAsClient, loginWithPassword } from '../api/authApi';
import type { User } from '../types';

const STORAGE_KEY = 'mindnote.session';

interface AuthContextValue {
  user: User | null;
  loginStaff: (email: string, password: string, role: 'counselor' | 'admin') => Promise<User>;
  enterClient: (alias: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): User | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeSession(user: User | null) {
  try {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소를 쓸 수 없어도 화면은 계속 동작한다 */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readSession);

  const commit = useCallback((next: User | null) => {
    setUser(next);
    writeSession(next);
  }, []);

  const loginStaff = useCallback<AuthContextValue['loginStaff']>(
    async (email, password, role) => {
      const next = await loginWithPassword(email, password, role);
      commit(next);
      return next;
    },
    [commit],
  );

  const enterClient = useCallback<AuthContextValue['enterClient']>(
    async (alias) => {
      const next = await enterAsClient(alias);
      commit(next);
      return next;
    },
    [commit],
  );

  const logout = useCallback(() => commit(null), [commit]);

  const value = useMemo(() => ({ user, loginStaff, enterClient, logout }), [user, loginStaff, enterClient, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
