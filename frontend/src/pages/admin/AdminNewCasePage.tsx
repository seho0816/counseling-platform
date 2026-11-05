import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, describeApiError } from '../../api/http';
import {
  createCase,
  createClient,
  fetchCounselors,
  validateCaseInput,
  validateClientInput,
} from '../../api/remoteAdminApi';
import PageHead from '../../components/PageHead';
import type { ApiCounselorAccount } from '../../types';

type ClientMode = 'new' | 'existing';

/**
 * 사례 등록(관리자) — 내담자 등록(POST /api/admin/clients)과 사례 생성(POST /api/admin/cases)을 이어서 한다.
 * 서버에 내담자 목록 API가 없어서, 이미 등록한 내담자는 번호를 직접 입력한다.
 * 이름·연락처에는 실제 개인정보 대신 가명·가상 데이터만 입력한다.
 */
export default function AdminNewCasePage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<ClientMode>('new');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientIdText, setClientIdText] = useState('');
  const [title, setTitle] = useState('');
  const [counselorIdText, setCounselorIdText] = useState(''); // '' = 미배정

  const [counselors, setCounselors] = useState<ApiCounselorAccount[]>([]);
  const [counselorError, setCounselorError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCounselors()
      .then((list) => !cancelled && setCounselors(list))
      .catch((e) => !cancelled && setCounselorError(describeApiError(e, '상담사 목록을 불러오지 못했어요.')));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    let clientId: number | null = null;
    if (mode === 'new') {
      const problem = validateClientInput({ name: clientName, contact: clientContact });
      if (problem) return setError(problem);
    } else {
      clientId = clientIdText.trim() === '' ? null : Number(clientIdText);
    }
    const caseProblem = validateCaseInput({ clientId: mode === 'new' ? 1 : clientId, title });
    if (caseProblem) return setError(caseProblem);
    const counselorId = counselorIdText === '' ? null : Number(counselorIdText);

    setBusy(true);
    let createdClientId: number | null = null;
    try {
      if (mode === 'new') {
        const client = await createClient({ name: clientName, contact: clientContact });
        createdClientId = client.id;
        clientId = client.id;
      }
      const created = await createCase({ clientId: clientId as number, counselorId, title });
      navigate(`/admin/cases/${created.id}`, { replace: true, state: { created: true } });
    } catch (err) {
      if (createdClientId !== null) {
        // 내담자는 이미 만들어졌으므로, 다시 눌렀을 때 중복 등록되지 않게 '기존 내담자' 모드로 바꾼다.
        setMode('existing');
        setClientIdText(String(createdClientId));
        setNotice(`내담자는 등록했어요(번호 ${createdClientId}). 사례 생성만 다시 시도해 주세요.`);
      }
      setError(describeCreateError(err));
      setBusy(false);
    }
  };

  return (
    <>
      <Link className="back-link" to="/admin/cases">
        사례 목록으로 돌아가기
      </Link>
      <PageHead title="새 사례 등록">
        내담자를 등록하고 사례를 만들어요. 서버(DB)에 실제로 저장되니 가상 데이터만 입력해 주세요.
      </PageHead>

      <form className="form form--narrow" onSubmit={handleSubmit} noValidate>
        <fieldset className="fieldset">
          <legend className="field__label">내담자</legend>
          <div className="chips" role="radiogroup" aria-label="내담자 선택 방식">
            <label className="check">
              <input type="radio" name="mode" checked={mode === 'new'} onChange={() => setMode('new')} />
              새 내담자 등록
            </label>
            <label className="check">
              <input type="radio" name="mode" checked={mode === 'existing'} onChange={() => setMode('existing')} />
              이미 등록한 내담자(번호 입력)
            </label>
          </div>
        </fieldset>

        {mode === 'new' ? (
          <>
            <div className="field">
              <label className="field__label" htmlFor="client-name">
                이름(가명)
              </label>
              <input
                id="client-name"
                className="field__input"
                autoComplete="off"
                placeholder="예: 가상내담자A"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <span className="field__hint">실명 대신 가명을 입력해 주세요. 1~100자.</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="client-contact">
                연락처(선택)
              </label>
              <input
                id="client-contact"
                className="field__input"
                autoComplete="off"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
              />
              <span className="field__hint">비워 둘 수 있어요. 실제 연락처는 입력하지 마세요. 50자 이하.</span>
            </div>
          </>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="client-id">
              내담자 번호
            </label>
            <input
              id="client-id"
              type="number"
              min={1}
              className="field__input"
              inputMode="numeric"
              value={clientIdText}
              onChange={(e) => setClientIdText(e.target.value)}
            />
            <span className="field__hint">내담자를 등록했을 때 받은 번호예요. 서버에 내담자 목록 조회 기능이 아직 없어요.</span>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="case-title">
            사례 제목
          </label>
          <input
            id="case-title"
            className="field__input"
            autoComplete="off"
            placeholder="예: 가상내담자A 초기 상담"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className="field__hint">1~200자.</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="case-counselor">
            담당 상담사
          </label>
          <select
            id="case-counselor"
            className="field__input"
            value={counselorIdText}
            onChange={(e) => setCounselorIdText(e.target.value)}
          >
            <option value="">미배정(나중에 배정)</option>
            {counselors.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.active}>
                {c.name} (#{c.id}){c.active ? '' : ' - 사용 중지'}
              </option>
            ))}
          </select>
          {counselorError ? <span className="field__hint">{counselorError} 미배정으로 만들고 나중에 배정할 수 있어요.</span> : null}
        </div>

        {notice ? (
          <p className="banner banner--ok" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? '등록하는 중이에요' : '사례 등록'}
          </button>
          <Link className="btn btn--quiet" to="/admin/cases">
            취소
          </Link>
        </div>
      </form>
    </>
  );
}

function describeCreateError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return '내담자 번호를 찾을 수 없어요. 번호를 확인해 주세요.';
    if (err.status === 400) return '입력값을 서버가 받아들이지 못했어요. 이름·제목 길이와 상담사 선택을 확인해 주세요.';
  }
  return describeApiError(err, '등록하지 못했어요.');
}
