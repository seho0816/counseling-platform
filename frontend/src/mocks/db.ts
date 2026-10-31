import type { Account, AccessLog, IntakeForm, Session, SessionSummary, StoredCase } from '../types';
import { buildSeed } from './seed';

/**
 * Mock 데이터베이스. 브라우저 localStorage에 저장해서 새로고침해도 유지된다.
 * 실제 서비스에서는 백엔드 DB가 맡는 부분이며, 화면은 이 파일을 직접 읽지 않고 src/api/* 를 거친다.
 */
export interface Db {
  seq: number;
  accounts: Account[];
  cases: StoredCase[];
  sessions: Session[];
  summaries: SessionSummary[];
  intakes: IntakeForm[];
  logs: AccessLog[];
}

const STORAGE_KEY = 'mindnote.mockdb.v2';
let db: Db | null = null;

function load(): Db | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Db) : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* 저장소를 쓸 수 없어도 이번 접속 동안은 메모리로 동작한다 */
  }
}

export function getDb(): Db {
  if (!db) {
    db = load() ?? buildSeed();
    persist();
  }
  return db;
}

/** getDb()로 받은 데이터를 고친 뒤 반드시 호출해서 저장한다. */
export function commit() {
  persist();
}

export function nextId(prefix: string): string {
  const d = getDb();
  d.seq += 1;
  return `${prefix}-${String(d.seq).padStart(4, '0')}`;
}

export function resetDb() {
  db = buildSeed();
  persist();
}
