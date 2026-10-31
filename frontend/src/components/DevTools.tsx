import { useState } from 'react';
import { resetDb } from '../mocks/db';

const SIM_FAIL_KEY = 'mindnote.sim.aiFail';

/** 개발용 도구(npm run dev에서만 보인다): AI 실패 흉내, Mock 데이터 초기화 */
export default function DevTools() {
  const [fail, setFail] = useState(() => localStorage.getItem(SIM_FAIL_KEY) === '1');

  return (
    <div className="dev-hint">
      <span>개발용 도구</span>
      <label className="check">
        <input
          type="checkbox"
          checked={fail}
          onChange={(e) => {
            setFail(e.target.checked);
            localStorage.setItem(SIM_FAIL_KEY, e.target.checked ? '1' : '0');
          }}
        />
        AI 요약 실패 흉내
      </label>
      <button
        type="button"
        className="btn btn--quiet btn--sm"
        onClick={() => {
          resetDb();
          window.location.reload();
        }}
      >
        Mock 데이터 초기화
      </button>
    </div>
  );
}
