# 마음기록 프론트엔드

상담·복지기관용 상담기록 요약 및 AI 비대면 상담 지원 시스템의 프론트엔드입니다.
React + TypeScript + Vite로 만들었고, **백엔드와 AI가 없어도 필수 기능(F-01~F-05)의 화면과 흐름이 Mock 데이터로 끝까지 동작**합니다.

## 실행

Spring Boot(백엔드)와 React(프론트엔드)를 터미널 2개로 함께 켠다. Node.js 18 이상, JDK 23이 필요하다.

**터미널 1 — Spring Boot** (`.env`는 GitHub에 올라가지 않으므로 따로 전달받는다)

```bash
cd counseling-platform/backend
set -a
source ../.env
set +a
./gradlew bootRun
```

**터미널 2 — React**

```bash
cd counseling-platform/frontend
npm install        # 처음 한 번
npm run dev        # http://localhost:5173
```

Spring Boot는 `localhost:8080`, React는 `localhost:5173`에서 실행한다.
프론트에서는 `http://localhost:8080`을 직접 쓰지 않고 `/api/...`로만 요청한다. Vite 프록시(`vite.config.ts`)가 `/api`를 8080으로 전달한다. 이 설정을 바꾸면 Vite를 다시 시작해야 한다.

## 백엔드 연동 현황

| 화면·기능 | 데이터 | 비고 |
| --- | --- | --- |
| 서버 상태(로그인 화면) | **실제 API** | `GET /api/health` → "서버 상태: 연결됨" |
| 로그인·로그아웃(상담사, 관리자) | **실제 API** | CSRF → 로그인(form) → CSRF 갱신 → `/api/auth/me` |
| 로그인 여부 판단 | **실제 API** | 앱을 열 때 `GET /api/auth/me`. 사용자 정보를 브라우저에 저장하지 않음 |
| 사례 목록(`/counselor/cases`, `/admin/cases`) | **실제 API** | `GET /api/cases?page=&size=`. 관리자는 전체, 상담사는 본인 배정 사례. 관리자 목록은 상담사 이름 표시 |
| 사례 상세(`/counselor/cases/:id`, `/admin/cases/:id`) | **실제 API** | `GET /api/cases/{id}`. 회기·요약 영역은 "구현 예정" 자리 |
| 사례 등록(`/admin/cases/new`, 관리자) | **실제 API** | 내담자 등록 `POST /api/admin/clients` → 사례 생성 `POST /api/admin/cases`. 이미 등록한 내담자는 번호로 선택(내담자 목록 API 없음) |
| 상담사 배정·해제(사례 상세, 관리자) | **실제 API** | `PATCH /api/admin/cases/{id}/assignment` (`counselorId: null`이면 해제) |
| 상담사 홈(상태 현황) | **실제 API** | 같은 `GET /api/cases` |
| 계정·권한(`/admin/accounts`) | **실제 API** | 상담사 목록 `GET /api/admin/counselors`, 등록 `POST /api/admin/counselors`. **사용 중지 버튼은 API가 없어 비활성 표시** |
| 내담자 입장 | 가상 | 백엔드에 내담자 로그인이 없음(가상 입장) |
| 상담사용 사례 등록(`/counselor/cases/new`), 회기 기록, AI 요약 | 가상(Mock) | 화면 위에 "가상 데이터 화면" 안내가 표시됨. 백엔드는 사례 생성을 관리자만 허용함 |
| 챗봇, 상담사 찾기 | 가상(Mock) | 같은 안내 표시 |
| 접근 로그 | 가상(Mock) | 같은 안내 표시 |

**백엔드에 이미 있는 API(2026-11-03 가이드 기준 12개)는 모두 연결되어 있다.** 남은 가상(Mock) 화면은 백엔드 API가 없는 기능이다.

가상 데이터 화면에는 `src/components/MockNotice.tsx` 안내가 붙는다(`App.tsx`의 `<Mock>` 래퍼). 화면을 실제 API로 연결하면 그 화면의 `<Mock>` 래퍼를 뺀다.

로그인은 상담사·관리자 모두 백엔드에 등록된 계정을 쓴다. 비밀번호는 팀에서 따로 전달받는다. 처음 확인할 때는 관리자 계정이 편하다(상담사 계정은 본인에게 배정된 사례만 보인다).

### 연동 코드 위치

| 파일 | 역할 |
| --- | --- |
| `src/api/http.ts` | 공통 요청. `credentials: 'include'`, CSRF 토큰 보관·갱신, 403이면 토큰을 새로 받아 한 번 재시도, 401이면 로그인 상태 해제, 오류 문구 |
| `src/api/authApi.ts` | 로그인·로그아웃·`/me`. 백엔드 역할(ADMIN·COUNSELOR)을 화면 역할로 변환 |
| `src/api/remoteCaseApi.ts` | `fetchCases()`, `fetchCase(id)`와 응답 변환(숫자 ID, 영어 상태, null 필드) |
| `src/api/remoteAdminApi.ts` | 상담사 목록·등록, 내담자 등록, 사례 생성, 상담사 배정, 입력 검사(백엔드 규칙과 동일) |
| `src/api/healthApi.ts` | 서버 상태 확인(`/api/health`) |
| `src/constants/labels.ts` | 상태 변환표(RECEIVED→접수, IN_PROGRESS→진행, CLOSED→종결, REFERRED→연계) |
| `src/api/caseApi.ts`, `adminApi.ts` 등 기존 파일 | Mock. 아직 쓰는 화면(가상 데이터 화면)이 있어 그대로 둠 |
| `src/pages/counselor/CaseDetailMockPage.tsx` | 예전 Mock 사례 상세(보존용, 라우트 연결 없음). 회기·상태 변경을 실제 API로 만들 때 참고 |

### 로그인이 안 될 때
- `서버에 연결하지 못했어요` → Spring Boot가 켜져 있는지 확인(`http://localhost:8080/api/health`가 OK인지).
- `이메일 또는 비밀번호가 맞지 않아요` → 백엔드에 등록된 이메일(소문자)과 비밀번호인지 확인.
- 로그인은 되는데 목록이 비어 있음 → 상담사 계정이면 본인에게 배정된 사례만 보인다. 관리자 계정으로 확인.
- 설정을 바꿨는데 반영이 안 됨 → Vite 개발 서버를 다시 시작.


## 구현된 흐름

| 요구사항 | 화면과 동작 |
| --- | --- |
| F-01-1 사례 등록 | 사례 목록 → 새 사례 등록(가명·연령대·분야). 상태는 접수로 시작 |
| F-01-2 회기 기록 | 사례 상세 → 회기 추가(일시·방식·기록 작성). 확정 전까지 기록 수정 가능 |
| F-02 AI 요약 | 회기 화면에서 요약 만들기 → 초안(주요 호소·개입 내용·다음 계획) 검토·수정 → 초안 저장 → 확정. 확정 전에는 "참고용 초안"이고, 확정하면 기록·요약을 고칠 수 없음 |
| F-02-3 개인정보 마스킹 | 이름·연락처를 가린 뒤 요약하고, 가린 건수를 화면에 표시 |
| F-02-4 원문 대조 | 요약 항목의 "원문 근거 보기"를 누르면 근거 문장이 기록에 표시됨 |
| NFR-09 AI 실패 대응 | 실패 시 오류 안내, 다시 시도, 직접 작성하기 |
| F-03-1 회기 이력 | 사례 상세에 회기별 요약 상태(요약 없음·검토 필요·확정) 표시 |
| F-03-2 사례 상태 | 접수 → 진행 → 종결 또는 연계. 되돌릴 수 없는 변경은 한 번 더 확인. 접수·종결·연계 상태에서는 회기 추가 불가 (`src/domain/caseState.ts`, State 패턴) |
| F-04 챗봇 | 기관·프로그램 안내, 신청 절차, 초기 질문지(5문항), 접수 확인 → 제출하면 '접수' 사례 생성. 분야에 맞는 상담사에게 배정 |
| F-04-4 역할 경계 | 상담·진단·조언을 요청하면 "할 수 없다"고 알리고 안내로 이어줌 |
| F-04-5 위기 고정 응답 | 위기 표현이 입력되면 AI 응답 없이 고정 문구와 109 안내를 보여주고, 접수 시 위기 표시를 붙임. 상담사 홈에서 맨 앞에 표시 (`src/chatbot/safety.ts`) |
| F-05-1 계정 | 상담사·관리자 로그인, 관리자의 계정 추가·사용 중지(중지되면 로그인 불가, 상담사 찾기에서 제외) |
| F-05-2 권한 | 상담사는 담당 사례만 열람. 다른 사례 주소로 들어가면 차단하고 기록 (`src/api/caseGuard.ts`, 보호 프록시) |
| F-05-3 접근 로그 | 조회·등록·작성·수정·확정·상태 변경·접근 차단을 기록. 관리자가 사용자·동작·차단 여부로 거름 |
| X-01~X-03 | 상담사 찾기(검색·분야·방식 필터), 상담사 상세와 가능 시간 |

예약 확정과 상담 방식 선택(X-04, X-05)은 아직 없습니다.

## 첫 연동 확인 순서

1. Spring Boot와 React를 각각 실행한다(위 "실행" 참고). `http://localhost:8080/api/health`가 `OK`인지 먼저 본다.
2. 브라우저에서 `http://localhost:5173/login` → "기관 관리자" 탭 → 백엔드에 등록된 관리자 계정으로 로그인한다.
3. 개발자 도구 Network 탭에서 `csrf` → `login` → `csrf` → `me` 순서로 모두 200인지 확인한다.
4. 자동으로 `/admin/cases`(전체 사례 목록)가 열린다. Network 탭의 `cases?page=0&size=20`이 200이고, 표에 Supabase의 가상 상담 사례가 보이는지 확인한다.
5. Supabase에서 사례 제목을 수정하고, 화면의 "다시 불러오기"(또는 새로고침)를 눌러 변경된 제목이 보이는지 확인한다.
6. 목록에서 이름을 누르면 사례 상세가 열린다(`GET /api/cases/{id}`).
7. 관리자의 "계정·권한"에서 서버의 상담사 계정이 보이는지 확인하고, 상담사 계정을 하나 등록해 본다(비밀번호 12자 이상).
8. 사례 목록의 "새 사례 등록"으로 가상 내담자와 사례를 만들고(가상 데이터만 입력), 사례 상세의 "상담사 배정"에서 상담사를 배정·해제해 본다. Supabase에서 같은 데이터가 보이는지 확인한다.
9. (선택) 배정된 상담사 계정으로 로그인하면 `/counselor`와 `/counselor/cases`에 본인에게 배정된 사례만 보이고, 남의 사례 주소는 열리지 않는다(404 안내).

> 상담사·관리자 로그인이 실제 백엔드 계정으로 바뀌어서, 예전 Mock 계정(`counselor@mindnote.test` 등)으로는 로그인할 수 없다.
> 사례 상세·회기 기록·AI 요약 같은 Mock 화면은 API가 연결되기 전까지 상담사 로그인으로는 열어도 데이터가 맞지 않는다.

## 폴더 구조

```
src/
  api/          서비스 계층. 지금은 Mock, 나중에 fetch로 교체
  auth/         로그인 상태, 역할별 화면 가드
  chatbot/      챗봇: 안내 문구(script), 안전 규칙(safety), 대화 흐름(chatReducer)
  components/   공통 조각(요약 패널, 상담사 카드, 확인 창 등)
  constants/    상담 분야, 위기 안내 고정 문구, 라벨
  domain/       사례 상태 전이(State), 요약 생성기·개인정보 가리기(Mock)
  layouts/      역할별 레이아웃
  mocks/        가상 데이터(localStorage에 저장되어 새로고침해도 유지)
  pages/        화면. counselor/ client/ admin/
  styles/       tokens.css(색·글자), global.css
  types/        Counselor, Case, Session, SessionSummary, IntakeForm, AccessLog …
  utils/        날짜·가능 시간 계산
```

## 백엔드·AI 연동

화면은 `src/api/*` 함수만 부르므로, 함수 안의 Mock만 `fetch`로 바꾸면 화면 코드는 그대로 둘 수 있습니다.

| 파일 | 함수 | 담당 | 바꿀 내용 |
| --- | --- | --- | --- |
| `authApi.ts` | `loginWithPassword`, `enterAsClient` | 백엔드 | 로그인 API |
| `caseApi.ts` | `listCases`, `getCase`, `createCase`, `changeStatus` | 백엔드 | 사례 API. 상태 전이 규칙은 서버에서도 검사 |
| `caseApi.ts` | `listSessions`, `createSession`, `updateRecord`, `getIntake` | 백엔드 | 회기·기록·질문지 API |
| `summaryApi.ts` | `generateSummary` | AI·데이터 | 요약 생성 API. 마스킹 후 LLM 호출 |
| `summaryApi.ts` | `saveDraft`, `confirmSummary`, `createManualDraft` | 백엔드 | 요약 저장·확정 API |
| `chatbotApi.ts` | `submitIntake` | 백엔드 | 질문지 저장과 사례 생성, 상담사 배정 |
| `adminApi.ts` | `listLogs`, `listAccounts`, `setAccountActive`, `createCounselorAccount` | 백엔드 | 관리자 API |
| `accessLog.ts`, `caseGuard.ts` | 로그 기록, 권한 검사 | 백엔드 | **서버에서 모든 요청마다 수행**. 프론트에서 하면 우회할 수 있음 |

요약 생성 API는 `{ complaint, intervention, nextPlan, evidence, maskedCount }` 모양으로 돌려주면 화면을 그대로 쓸 수 있습니다 (`src/types/index.ts`의 `SummaryFields`, `EvidenceMap` 참고).
`src/domain/summarizer.ts`는 가짜 요약기라서 실제 AI로 바꾸면 지워도 됩니다. 챗봇의 위기 감지(`safety.ts`)는 서버에서도 한 번 더 확인하세요.

## 확인이 필요한 값

- 위기 안내 문구와 긴급 연락처(109): `src/constants/crisis.ts`. 상담 전문가·기관 확인 후 확정
- 위기 키워드 목록: `src/chatbot/safety.ts`. 전문가 검수 필요
- 챗봇이 안내하는 프로그램 정보(가상): `src/chatbot/script.ts`
- 상담 분야 분류: `src/constants/fields.ts`
- 글꼴(Pretendard)은 CDN으로 불러옵니다. 오프라인이면 `index.html`을 바꾸세요.

## 다음 단계 (백엔드 API가 만들어지면)

1. 회기 생성·조회, AI 요약 생성·저장·확정 → 사례 상세의 "구현 예정" 자리를 연결(요약은 AI 응답 JSON 3항목 구조에 맞춤)
2. 챗봇 접수(질문지 저장, 위기 표시) → 챗봇 화면 연결
3. 접근 로그 기록·조회 → 접근 로그 화면 연결
4. 계정 사용 중지·재사용 → 계정·권한의 비활성 버튼 연결
5. 내담자 목록 조회 → 사례 등록에서 번호 입력 대신 선택으로 바꾸기
6. 사례 상태 변경, 상태 조건 조회 → 상태 변경·목록 필터 연결
연결한 화면은 `App.tsx`의 `<Mock>` 래퍼를 뺀다.
