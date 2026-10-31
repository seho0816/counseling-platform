import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createCounselorAccount, listAccounts, setAccountActive, type AccountRow } from '../../api/adminApi';
import { useAuth } from '../../auth/AuthContext';
import ConfirmInline from '../../components/ConfirmInline';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';

/** 계정·권한 관리 (F-05-1, F-05-2). 담당 사례는 건수만 보이고 내용은 볼 수 없다. */
export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingOff, setPendingOff] = useState<AccountRow | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setAccounts(await listAccounts(user));
    } catch {
      setFailed(true);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async (account: AccountRow, active: boolean) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await setAccountActive(user, account.id, active);
      setMessage(`${account.name} 계정을 ${active ? '다시 사용하도록' : '사용 중지로'} 바꿨어요.`);
      setPendingOff(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !email.trim()) {
      setError('이름과 이메일을 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createCounselorAccount(user, { name, email });
      setMessage(`${name.trim()} 상담사 계정을 추가했어요.`);
      setName('');
      setEmail('');
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="계정·권한">
        상담사 계정을 관리해요. 상담사는 자신이 담당하는 사례만 볼 수 있고, 관리자는 사례 내용을 볼 수 없어요.
      </PageHead>

      {message ? (
        <p className="banner banner--ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {adding ? (
        <form className="panel form form--narrow" onSubmit={handleAdd} noValidate>
          <h2>상담사 계정 추가</h2>
          <div className="field">
            <label className="field__label" htmlFor="new-name">
              이름
            </label>
            <input id="new-name" className="field__input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="new-email">
              이메일
            </label>
            <input id="new-email" type="email" className="field__input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="field__hint">개발용 기본 비밀번호는 counselor1234예요.</span>
          </div>
          <div className="actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '추가하는 중이에요' : '계정 추가'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setAdding(false)}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="toolbar">
          <span />
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
            상담사 계정 추가
          </button>
        </div>
      )}

      {pendingOff ? (
        <ConfirmInline
          message={`${pendingOff.name} 계정을 사용 중지할까요? 로그인할 수 없고 상담사 찾기에서도 사라져요. 담당 사례 ${pendingOff.caseCount}건은 그대로 남아요.`}
          confirmLabel="사용 중지"
          busy={busy}
          onConfirm={() => toggle(pendingOff, false)}
          onCancel={() => setPendingOff(null)}
        />
      ) : null}

      {failed ? (
        <StateMessage role="alert" message="계정을 불러오지 못했어요. 페이지를 새로 고쳐 주세요." />
      ) : accounts === null ? (
        <StateMessage message="계정을 불러오는 중이에요." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">계정 목록</caption>
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">역할</th>
                <th scope="col">이메일</th>
                <th scope="col">담당 사례</th>
                <th scope="col">상태</th>
                <th scope="col">
                  <span className="visually-hidden">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{a.name}</th>
                  <td>{a.role === 'admin' ? '기관 관리자' : '상담사'}</td>
                  <td>{a.email}</td>
                  <td>{a.role === 'counselor' ? `${a.caseCount}건` : '-'}</td>
                  <td>
                    <span className={`tag ${a.active ? '' : 'tag--alert'}`}>{a.active ? '사용 중' : '사용 중지'}</span>
                  </td>
                  <td>
                    {a.role === 'admin' ? null : a.active ? (
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => setPendingOff(a)} aria-label={`${a.name} 사용 중지`}>
                        사용 중지
                      </button>
                    ) : (
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => toggle(a, true)} disabled={busy} aria-label={`${a.name} 다시 사용`}>
                        다시 사용
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
