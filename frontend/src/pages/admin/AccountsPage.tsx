import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createCounselor, fetchCounselors, validateCounselorInput } from '../../api/remoteAdminApi';
import { ApiError, describeApiError } from '../../api/http';
import PageHead from '../../components/PageHead';
import StateMessage from '../../components/StateMessage';
import type { ApiCounselorAccount } from '../../types';

/**
 * 계정·권한 — 상담사 계정 목록(GET)과 등록(POST)을 실제 API로 연결했다.
 * - 관리자 계정은 백엔드 목록 API에 없어서 보이지 않는다.
 * - 사용 중지(비활성화) API가 아직 없어서 버튼은 비활성으로 표시한다.
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ApiCounselorAccount[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

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
        상담사 계정을 서버(Spring Boot)에서 불러와요. 상담사는 자신에게 배정된 사례만 볼 수 있고, 관리자는 모든 사례를 볼 수 있어요.
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
                    {/* 사용 중지·재사용 API가 아직 없어서 비활성으로 표시한다 */}
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      disabled
                      title="사용 중지 기능은 서버 API가 만들어지면 연결돼요"
                      aria-label={`${a.name} ${a.active ? '사용 중지' : '다시 사용'} (아직 사용할 수 없어요)`}
                    >
                      {a.active ? '사용 중지' : '다시 사용'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="field__hint">
        사용 중지·다시 사용 버튼은 서버에 해당 API가 만들어지면 연결해요. 관리자 계정은 이 목록에 나오지 않아요.
      </p>
    </>
  );
}
