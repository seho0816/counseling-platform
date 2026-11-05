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

  /** status 0은 서버에 연결하지 못한 경우(네트워크 오류) */
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
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

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, '서버에 연결하지 못했어요.');
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
    return send(url, { method, headers, body });
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

/** 화면에 보여줄 오류 문구. 상태 코드별로 다음 행동을 알려준다. */
export function describeApiError(error: unknown, fallback = '요청을 처리하지 못했어요.'): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 0 || error.status >= 500) {
    return '서버에 연결하지 못했어요. Spring Boot가 켜져 있는지(localhost:8080) 확인해 주세요.';
  }
  if (error.status === 401) return '로그인이 필요하거나 세션이 끝났어요. 다시 로그인해 주세요.';
  if (error.status === 403) return '이 작업을 할 권한이 없어요.';
  if (error.status === 404) return '요청한 데이터를 찾을 수 없어요.';
  return `${fallback} (${error.status})`;
}
