/**
 * Spring Boot와 통신하는 공통 요청 모듈.
 *
 * - 모든 요청은 /api/... 로 보낸다(Vite 프록시가 localhost:8080으로 전달).
 * - 세션 쿠키(JSESSIONID)를 쓰므로 credentials: 'include'를 항상 켠다.
 * - POST·PATCH·PUT·DELETE에는 CSRF 토큰을 헤더에 붙인다. 토큰은 이 모듈이 보관한다.
 * - 비밀번호·토큰을 localStorage 등에 저장하지 않는다(메모리에서만 보관).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** 정해 둔 시간 안에 응답이 오지 않아 요청을 끊은 경우 */
  readonly timeout: boolean;

  /** status 0은 서버에 연결하지 못한 경우(네트워크 오류 또는 시간 초과) */
  constructor(status: number, message: string, body?: unknown, timeout = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.timeout = timeout;
  }
}

interface CsrfInfo {
  headerName: string;
  token: string;
}

let csrf: CsrfInfo | null = null;

/** 401이 오면(세션 만료 등) 로그인 상태를 풀기 위해 AuthProvider가 등록하는 콜백 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearCsrf() {
  csrf = null;
}

/**
 * 기본 시간 제한. 배포 서버(Render 무료)는 한동안 쓰지 않으면 잠들어서 첫 응답에 1분 가까이 걸릴 수 있고,
 * AI 요약은 서버가 최대 45초까지 기다리므로 넉넉하게 둔다. 요청마다 timeoutMs로 바꿀 수 있다.
 */
export const DEFAULT_TIMEOUT_MS = 75_000;

async function send(path: string, init: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(path, { credentials: 'include', ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, '서버 응답이 너무 늦어요.', undefined, true);
    }
    throw new ApiError(0, '서버에 연결하지 못했어요.');
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** GET /api/auth/csrf — 로그인 전·후에 모두 호출해서 토큰을 갱신한다. */
export async function refreshCsrf(): Promise<CsrfInfo> {
  const response = await send('/api/auth/csrf', { method: 'GET' });
  if (!response.ok) throw new ApiError(response.status, 'CSRF 토큰을 받지 못했어요.', await readBody(response));
  csrf = (await response.json()) as CsrfInfo;
  return csrf;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON 본문 (Content-Type: application/json) */
  json?: unknown;
  /** 폼 본문 (application/x-www-form-urlencoded). 로그인에서만 쓴다. */
  form?: Record<string, string>;
  query?: Record<string, string | number>;
  /** 이 시간(밀리초) 안에 응답이 없으면 요청을 끊는다. 기본값은 DEFAULT_TIMEOUT_MS */
  timeoutMs?: number;
}

const AUTH_CHECK_PATHS = ['/api/auth/login', '/api/auth/me'];

/**
 * 공통 요청 함수. 성공하면 JSON(없으면 undefined)을 돌려주고, 실패하면 ApiError를 던진다.
 * CSRF 오류로 보이는 403이면 토큰을 새로 받아 한 번만 다시 시도한다.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const needsCsrf = method !== 'GET';
  const url = options.query
    ? `${path}?${new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)]))}`
    : path;

  const attempt = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form);
    }
    if (needsCsrf) {
      const info = csrf ?? (await refreshCsrf());
      headers[info.headerName] = info.token;
    }
    return send(url, { method, headers, body }, options.timeoutMs);
  };

  let response = await attempt();
  if (response.status === 403 && needsCsrf) {
    await refreshCsrf();
    response = await attempt();
  }

  if (!response.ok) {
    const body = await readBody(response);
    if (response.status === 401 && !AUTH_CHECK_PATHS.includes(path)) unauthorizedHandler?.();
    throw new ApiError(response.status, `요청이 실패했어요 (${response.status})`, body);
  }
  return (await readBody(response)) as T;
}

/** 개발 중(npm run dev)에만 덧붙이는 안내 */
const DEV_HINT = import.meta.env.DEV ? ' 개발 중이라면 Spring Boot(localhost:8080)가 켜져 있는지 확인해 주세요.' : '';

/** 화면에 보여줄 오류 문구. 상태 코드별로 다음 행동을 알려준다. */
export function describeApiError(error: unknown, fallback = '요청을 처리하지 못했어요.'): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.timeout) return `서버 응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요.${DEV_HINT}`;
  if (error.status === 0) return `서버에 연결하지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 시도해 주세요.${DEV_HINT}`;
  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return `서버가 아직 준비 중이거나 응답하지 못했어요. 한동안 쓰지 않았다면 서버가 깨어나는 데 1분쯤 걸릴 수 있어요. 잠시 뒤 다시 시도해 주세요.${DEV_HINT}`;
  }
  if (error.status >= 500) return `서버에서 오류가 났어요. 잠시 뒤 다시 시도해 주세요.${DEV_HINT}`;
  if (error.status === 401) return '로그인이 필요하거나 세션이 끝났어요. 다시 로그인해 주세요.';
  if (error.status === 403) return '이 작업을 할 권한이 없어요.';
  if (error.status === 404) return '요청한 데이터를 찾을 수 없어요.';
  return `${fallback} (${error.status})`;
}

/**
 * 서버가 오류 본문에 담아 준 메시지(있을 때만). 백엔드 설정에 따라 없을 수 있다.
 * 화면에는 한국어 안내를 먼저 보여주고, 이 값은 참고용 작은 글씨로만 덧붙인다.
 */
export function serverDetail(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message.trim();
  }
  return null;
}
