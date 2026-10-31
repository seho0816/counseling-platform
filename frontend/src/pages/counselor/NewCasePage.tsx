import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCase } from '../../api/caseApi';
import { useAuth } from '../../auth/AuthContext';
import PageHead from '../../components/PageHead';
import { AGE_GROUPS, COUNSELING_FIELDS, type AgeGroup } from '../../constants/fields';

/** 사례 등록 (F-01-1). 실제 이름 대신 가명으로 등록하고, 상태는 '접수'로 시작한다. */
export default function NewCasePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alias, setAlias] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('20대');
  const [concern, setConcern] = useState<string>(COUNSELING_FIELDS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!alias.trim()) {
      setError('내담자를 구분할 가명을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createCase(user, { alias, ageGroup, concern });
      navigate(`/counselor/cases/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <>
      <Link className="back-link" to="/counselor/cases">
        사례 목록으로 돌아가기
      </Link>
      <PageHead title="새 사례 등록">실명 대신 가명으로 등록해요. 등록하면 ‘접수’ 상태로 시작해요.</PageHead>

      <form className="form form--narrow" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="alias">
            가명
          </label>
          <input
            id="alias"
            className="field__input"
            autoComplete="off"
            placeholder="예: 하늘"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
          <span className="field__hint">‘(가명)’은 자동으로 붙어요.</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="age">
            연령대
          </label>
          <select id="age" className="field__input" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
            {AGE_GROUPS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="concern">
            주된 상담 분야
          </label>
          <select id="concern" className="field__input" value={concern} onChange={(e) => setConcern(e.target.value)}>
            {COUNSELING_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? '등록하는 중이에요' : '사례 등록'}
          </button>
          <Link className="btn btn--quiet" to="/counselor/cases">
            취소
          </Link>
        </div>
      </form>
    </>
  );
}
