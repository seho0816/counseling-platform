import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createCounselor, fetchCounselors, setCounselorActive, validateCounselorInput } from '../../api/remoteAdminApi';
import { ApiError, describeApiError } from '../../api/http';
import ConfirmInline from '../../components/ConfirmInline';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import type { ApiCounselorAccount } from '../../types';

/**
 * 계정·권한 — 상담사 계정 목록(GET)과 등록(POST)을 실제 API로 연결했다.
 * - 사용 중지·다시 사용은 PATCH /api/admin/counselors/{id}/status 로 바꾸고, 바꾼 뒤 목록을 새로 불러온다.
 * - 관리자 계정은 백엔드 목록 API에 없어서 보이지 않는다.
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ApiCounselorAccount[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // 사용 중지·다시 사용
  const [toggleTarget, setToggleTarget] = useState<ApiCounselorAccount | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState('');

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const refresh = useCallback(async () => {
    setLoadError('');
    try {
      setAccounts(await fetchCounselors());
    } catch (e) {
      setLoadError(describeApiError(e, '계정 목록을 불러오지 못했어요.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const closeForm = () => {
    setAdding(false);
    setPassword(''); // 비밀번호를 화면 상태에 남기지 않는다
    setFormError('');
  };

  /** 상담사의 사용 상태를 바꾼다. 중지는 확인을 거친 뒤, 다시 사용은 바로 실행한다. */
  const changeActive = async (account: ApiCounselorAccount, next: boolean) => {
    setTogglingId(account.id);
    setToggleError('');
    setMessage('');
    try {
      await setCounselorActive(account.id, next);
      setToggleTarget(null);
      await refresh(); // 목록을 먼저 새로 맞춘 뒤 알린다
      setMessage(next ? `${account.name} 상담사를 다시 사용하도록 바꿨어요.` : `${account.name} 상담사의 사용을 중지했어요.`);
    } catch (e) {
      setToggleTarget(null);
      if (e instanceof ApiError && e.status === 404) {
        setToggleError('상담사를 찾을 수 없어요. 목록을 새로 불러온 뒤 다시 시도해 주세요.');
        await refresh();
      } else if (e instanceof ApiError && e.status === 400) {
        setToggleError('요청을 서버가 받아들이지 못했어요. 화면을 새로 불러온 뒤 다시 시도해 주세요.');
      } else {
        setToggleError(describeApiError(e, '사용 상태를 바꾸지 못했어요.'));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateCounselorInput({ name, email, password });
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createCounselor({ name, email, password });
      const registered = name.trim();
      setName('');
      setEmail('');
      closeForm();
      await refresh(); // 목록을 먼저 새로 맞춘 뒤 알린다
      setMessage(`${registered} 상담사 계정을 등록했어요.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setFormError('이미 등록된 이메일이에요.');
      else if (err instanceof ApiError && err.status === 400) {
        setFormError('입력값을 확인해 주세요. 이메일 형식과 비밀번호 길이(12자 이상)를 서버가 거절했어요.');
      } else setFormError(describeApiError(err, '계정을 등록하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="계정·권한">
        상담사 계정을 등록하고 사용 여부를 정해요. 상담사는 자신에게 배정된 사례만 볼 수 있고, 관리자는 모든 사례를 볼 수 있어요.
      </PageHead>

      {message ? (
        <p className="banner banner--ok" role="status">
          {message}
        </p>
      ) : null}

      {adding ? (
        <form className="panel form form--narrow" onSubmit={handleAdd} noValidate>
          <h2>상담사 계정 등록</h2>
          <div className="field">
            <label className="field__label" htmlFor="new-name">
              이름
            </label>
            <input id="new-name" className="field__input" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="new-email">
              이메일(로그인 아이디)
            </label>
            <input
              id="new-email"
              type="email"
              className="field__input"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="new-password">
              임시 비밀번호
            </label>
            <input
              id="new-password"
              type="password"
              className="field__input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="field__hint">12자 이상(72바이트 이하). 상담사에게 따로 전달해 주세요. 이 화면에는 남지 않아요.</span>
          </div>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '등록하는 중이에요' : '계정 등록'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={closeForm} disabled={busy}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="toolbar">
          <span />
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
            상담사 계정 등록
          </button>
        </div>
      )}

      {toggleTarget ? (
        <div className="panel stack" role="group" aria-label="사용 중지 확인">
          <ConfirmInline
            message={`${toggleTarget.name} 상담사의 사용을 중지할까요? 중지하면 이 상담사는 로그인할 수 없고 새로 배정받을 수 없어요. 이미 배정된 사례는 그대로 남으니, 필요하면 다른 상담사에게 다시 배정해 주세요.`}
            confirmLabel="사용 중지"
            busy={togglingId === toggleTarget.id}
            onConfirm={() => void changeActive(toggleTarget, false)}
            onCancel={() => setToggleTarget(null)}
          />
        </div>
      ) : null}

      {toggleError ? (
        <p className="form-error" role="alert">
          {toggleError}
        </p>
      ) : null}

      {loadError && !accounts ? (
        <StateMessage
          role="alert"
          message={loadError}
          action={
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => void refresh()}>
              다시 불러오기
            </button>
          }
        />
      ) : accounts === null ? (
        <StateMessage message="계정을 불러오는 중이에요." />
      ) : accounts.length === 0 ? (
        <StateMessage message="등록된 상담사 계정이 아직 없어요. 위에서 상담사 계정을 등록해 보세요." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <caption className="visually-hidden">상담사 계정 목록</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">이름</th>
                <th scope="col">이메일</th>
                <th scope="col">역할</th>
                <th scope="col">상태</th>
                <th scope="col">
                  <span className="visually-hidden">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <th scope="row">{a.name}</th>
                  <td>{a.email}</td>
                  <td>상담사</td>
                  <td>
                    <span className={`tag ${a.active ? '' : 'tag--alert'}`}>{a.active ? '사용 중' : '사용 중지'}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      disabled={togglingId !== null || (toggleTarget !== null && toggleTarget.id !== a.id)}
                      onClick={() => {
                        setMessage('');
                        setToggleError('');
                        if (a.active) setToggleTarget(a);
                        else void changeActive(a, true);
                      }}
                      aria-label={`${a.name} ${a.active ? '사용 중지' : '다시 사용'}`}
                    >
                      {togglingId === a.id ? '바꾸는 중이에요' : a.active ? '사용 중지' : '다시 사용'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="field__hint">
        사용 중지한 상담사는 로그인할 수 없고 새 사례를 배정받을 수 없어요. 관리자 계정은 이 목록에 나오지 않아요.
      </p>
    </>
  );
}
