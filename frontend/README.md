# 마음기록 프론트엔드

상담·복지기관용 상담기록 요약 및 AI 비대면 상담 지원 시스템의 프론트엔드입니다.
React + TypeScript + Vite로 만들었고, **백엔드와 AI가 없어도 필수 기능(F-01~F-05)의 화면과 흐름이 Mock 데이터로 끝까지 동작**합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입 검사 + 빌드
```

Node.js 18 이상이 필요합니다. 압축을 풀면 생기는 `mindnote-frontend` 폴더 안에서 실행하세요.

## 개발용 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 상담사 (한서윤, 담당 사례 10건) | counselor@mindnote.test | counselor1234 |
| 상담사 (김도현, 박지민 등) | counselor2@mindnote.test … counselor8@mindnote.test | counselor1234 |
| 기관 관리자 | admin@mindnote.test | admin1234 |
| 내담자 | (없음) | 이름(가명)만 입력하고 입장 |

`npm run dev`에서는 로그인 화면에 계정 정보가 보이고, 상담사 화면 왼쪽 아래에 **개발용 도구**가 나타납니다.

- **AI 요약 실패 흉내**: 켜면 요약 생성이 실패해 오류 안내와 "직접 작성하기" 경로를 확인할 수 있어요.
- **Mock 데이터 초기화**: 지금까지 만든 사례·기록·로그를 지우고 처음 상태로 돌려요.

모든 데이터는 가상입니다. 실제 개인정보를 넣지 마세요.

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

## 직접 따라 해 보기 (약 5분)

1. **내담자**로 입장(이름 `하늘`) → 챗봇 안내 → 초기 질문지 작성 → "힘든 점"에 `사라지고 싶다는 생각이 들어요` 입력 → 고정 응답 확인 → 접수 이어가기 → 접수
2. **상담사** `counselor@mindnote.test` 로그인 → 홈 맨 위에 위기 표시 사례 → 열기 → 상담 시작(진행으로 변경) → 회기 추가 → 기록 저장
3. 회기 화면에서 AI 요약 만들기 → 원문 근거 보기 → 내용 고치기 → 확정하여 저장
4. 주소창에서 `/counselor/cases/case-011` 로 이동 → 담당 외 사례라서 차단됨
5. **관리자** `admin@mindnote.test` 로그인 → 접근 로그에서 "차단된 시도만 보기" → 방금 시도한 기록 확인 → 계정·권한에서 상담사 사용 중지

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

## 다음 단계

1. 예약 확정·상담 방식 선택 (X-04, X-05)
2. 요약 생성·사례·로그 API를 백엔드·AI와 합의한 명세로 연결
3. 정상·예외 테스트 케이스 작성(WBS 5.1), 사용성 시범 사용
