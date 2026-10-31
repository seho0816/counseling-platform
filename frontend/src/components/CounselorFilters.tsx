import { COUNSELING_FIELDS, METHOD_LABEL } from '../constants/fields';
import type { CounselorFilter } from '../api/counselorApi';
import type { ConsultMethod } from '../types';

interface Props {
  value: CounselorFilter;
  onChange: (next: CounselorFilter) => void;
}

const METHOD_OPTIONS: Array<ConsultMethod | 'all'> = ['all', 'chat', 'voice'];

export default function CounselorFilters({ value, onChange }: Props) {
  return (
    <section className="filters" aria-label="상담사 찾기 조건">
      <div className="field">
        <label className="field__label" htmlFor="counselor-query">
          이름·기관·소개로 찾기
        </label>
        <input
          id="counselor-query"
          type="search"
          className="field__input"
          placeholder="예: 한서윤, 복지관, 불안"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </div>

      <div className="filters__group" role="group" aria-labelledby="filter-field">
        <span id="filter-field" className="filters__label">
          주 상담 분야
        </span>
        <div className="chips">
          {(['all', ...COUNSELING_FIELDS] as const).map((field) => (
            <button
              key={field}
              type="button"
              className="chip"
              aria-pressed={value.field === field}
              onClick={() => onChange({ ...value, field })}
            >
              {field === 'all' ? '전체' : field}
            </button>
          ))}
        </div>
      </div>

      <div className="filters__group" role="group" aria-labelledby="filter-method">
        <span id="filter-method" className="filters__label">
          상담 방식
        </span>
        <div className="chips">
          {METHOD_OPTIONS.map((method) => (
            <button
              key={method}
              type="button"
              className="chip"
              aria-pressed={value.method === method}
              onClick={() => onChange({ ...value, method })}
            >
              {method === 'all' ? '전체' : METHOD_LABEL[method]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
