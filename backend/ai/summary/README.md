# 상담 기록 AI 요약 (backend/ai/summary)

상담사가 쓴 상담 기록 텍스트를 넣으면 AI가 **초안** 요약을 JSON으로 돌려준다.

## 범위

| 하는 일 | 하지 않는 일 |
| --- | --- |
| 기록에 적힌 내용을 `complaint`, `intervention`, `nextPlan` 세 항목으로 정리 | 상담, 위로, 진단, 평가, 조언 (이번 개발 범위에서 제외) |
| 기록에 없는 항목은 `"기록에 없음"` | 요약을 DB에 저장 (이 서비스는 저장하지 않는다) |
| 전화번호·이메일·주민등록번호를 AI에 보내기 전에 가림 | 이름 자동 삭제 (불가능, 아래 한계 참고) |

**요약은 항상 상담사의 검토와 승인이 필요한 초안이다.** 응답에는 `status: "DRAFT"`, `reviewRequired: true`가 들어 있고, 승인(CONFIRMED)과 저장은 백엔드가 한다. 승인 전에는 사례 이력에 저장하지 않는다.

## 입력과 출력 (백엔드와 확정할 형식)

**요청** `POST http://127.0.0.1:8001/api/ai/summary` (Content-Type: application/json; charset=utf-8)

```json
{ "recordText": "상담사가 작성한 상담 기록 텍스트" }
```

**성공 200**

```json
{
  "complaint": "내담자의 주요 고민",
  "intervention": "상담 중 다룬 내용 및 개입",
  "nextPlan": "향후 상담 계획",
  "status": "DRAFT",
  "aiGenerated": true,
  "reviewRequired": true,
  "model": "gemini-3.5-flash-lite",
  "promptVersion": "v5"
}
```

세 필드는 항상 비어 있지 않은 문자열이다. 해당 내용이 기록에 없으면 값이 정확히 `기록에 없음`이다.

**오류** 모든 오류는 같은 모양이다. `manualInput`이 true이면 화면에서 상담사가 직접 요약을 쓰는 입력창을 보여 준다.

```json
{ "error": "AI_UNAVAILABLE", "message": "AI 서비스에 연결하지 못했습니다", "manualInput": true }
```

| HTTP | error | 뜻 | manualInput | 백엔드 처리 |
| --- | --- | --- | --- | --- |
| 400 | EMPTY_RECORD | 기록이 비었거나 공백뿐 (AI를 호출하지 않음) | false | 입력하라고 안내 |
| 400 | INVALID_REQUEST | 요청 JSON이 틀림 (`recordText` 없음 등) | false | 백엔드 코드 확인 |
| 413 | RECORD_TOO_LONG | 기록이 너무 김 (기본 20000자) | false | 나눠서 요청 |
| 429 | AI_RATE_LIMITED | AI 호출 한도 초과. `retryAfterSeconds`가 있으면 그만큼 기다림 | true | 잠시 뒤 다시 시도 안내 |
| 502 | AI_UNAVAILABLE | AI 연결 실패 또는 서버 오류 (1회 재시도 후) | true | 재시도 버튼, 수동 입력 |
| 502 | AI_INVALID_RESPONSE | AI가 형식에 맞지 않게 답함 (1회 재시도 후) | true | 재시도 버튼, 수동 입력 |
| 502 | AI_AUTH_FAILED | API 키 오류 또는 권한 없음 | true | 개발자 확인 |
| 502 | AI_MODEL_NOT_FOUND | 모델 이름이 틀림 | true | 개발자 확인 |
| 500 | AI_NOT_CONFIGURED | 키 또는 프롬프트 파일이 없음 | true | 개발자 확인 |
| 500 | INTERNAL_ERROR | 서버 내부 오류 | true | 개발자 확인 |

`GET /health` → `{"status":"OK"}`

## 필드 이름 변경 안내

프론트엔드 기준 이름으로 맞췄다.

| 기존 AI 코드 | 새 이름 |
| --- | --- |
| `chief_complaint` | **`complaint`** |
| `intervention` | `intervention` (같음) |
| `next_plan` | **`nextPlan`** |

- 이 폴더의 코드와 프롬프트(`prompts/summary_prompt_v5.txt`)는 모두 새 이름이다.
- 아직 예전 이름을 쓰는 곳: `backend/ai/prompts/요약_프롬프트_v2·v3·v3_4항목.txt`, `backend/ai/api_test.py`(`REQUIRED`), `backend/ai/chatbot_test/11_json_validate.py`(`FIELDS`), `docs/ai/JSON_응답_구조.md`, "AI 연동 요청 명세" 문서(`chiefComplaint`). 새 코드는 이것들에 의존하지 않으므로 그대로 두거나 나중에 정리한다.
- DB 컬럼 이름은 백엔드가 정한다. 제안: `complaint`, `intervention`, `next_plan`.
- 3항목 기준이다. 팀이 4항목(내담자 상태 추가)으로 정하면 `clientState`를 추가한다.

## 환경 변수

| 이름 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | 필수 | 없음 | Google AI Studio에서 만든 키 (무료 등급 프로젝트여야 함) |
| `GEMINI_MODEL` | 선택 | `gemini-3.5-flash-lite` | 사용할 모델 이름 |
| `AI_HOST` | 선택 | `127.0.0.1` | 서버 주소. 기본은 내 컴퓨터에서만 접속됨 |
| `AI_PORT` | 선택 | `8001` | 서버 포트 (Spring은 8080) |
| `AI_MAX_RECORD_CHARS` | 선택 | `20000` | 기록 최대 글자 수 |
| `AI_PROMPT_FILE` | 선택 | `prompts/summary_prompt_v5.txt` | 다른 프롬프트로 시험할 때 |

**키는 환경 변수로만 넣는다.** `.env`에 적어도 되지만 GitHub에는 올리지 않는다(저장소 `.gitignore`가 `.env`를 막고, 이 폴더의 `.gitignore`도 막는다). 올려도 되는 건 값이 빈 `.env.example`뿐이다. 코드, 로그, 문서, 캡처에 키를 남기지 않는다.

## 실행 방법

Python 3.9 이상. 명령이 안 되면 `python` 대신 `py`를 쓴다 (Windows).

```
cd backend/ai/summary
pip install -r requirements.txt
export GEMINI_API_KEY=발급받은키      # Windows cmd: set GEMINI_API_KEY=발급받은키
```

**1) 한 건 시험 (명령줄)**
```
py cli.py --file 기록.txt
py cli.py --text "내담자는 최근 잠을 잘 못 잔다고 하였다. 다음 회기에 수면 기록을 가져오기로 하였다."
```

**2) 서버 실행 (백엔드가 호출)**
```
py server.py
curl -X POST http://127.0.0.1:8001/api/ai/summary -H "Content-Type: application/json; charset=utf-8" -d '{"recordText":"내담자는 최근 잠을 잘 못 잔다고 하였다."}'
```

## Spring Boot 연동 순서

1. 상담사가 요약 생성을 누르면 백엔드가 담당 사례 권한을 확인하고 회기 기록 텍스트를 읽는다.
2. `POST /api/ai/summary`를 호출한다 (연결 대기 5초, 응답 대기 30초 권장. 실제 응답은 보통 1~3초).
3. 200이면 초안(DRAFT)으로 저장하고 화면에 "AI 생성 결과, 오류 가능성 있음"과 함께 보여 준다. 오류이면 `manualInput`에 따라 수동 입력 화면을 보여 준다.
4. 상담사가 수정하고 승인하면 백엔드가 CONFIRMED로 바꾸고 사례 이력에 저장한다.

예시 (컴파일해 보지 않은 스케치):

```java
RestTemplate rt = new RestTemplate();
try {
    ResponseEntity<Map> res = rt.postForEntity("http://127.0.0.1:8001/api/ai/summary",
            Map.of("recordText", recordText), Map.class);
    Map body = res.getBody();            // complaint, intervention, nextPlan, status ...
} catch (HttpStatusCodeException e) {
    String errorJson = e.getResponseBodyAsString();   // {"error": "...", "manualInput": true}
}
```

## 시험

```
py -m unittest discover -s tests -v     # 키 없이 30개 (오류 처리, 서버, 검사 도구)
py tests/run_eval.py                    # 실제 LLM으로 가상 기록 18개 평가 (키 필요, 약 1분)
py tests/run_eval.py --fake             # 키 없이 평가 도구만 점검 (LLM 결과가 아님)
```

`run_eval.py`는 `eval_output/`에 `eval_results_LLM.csv`(엑셀로 열림)와 `eval_report_LLM.md`를 만든다. 평가 입력은 `tests/eval_cases.json`이다.

자동 검사 항목: 세 필드가 비어 있지 않은가, 기록에 없어야 할 항목이 `기록에 없음`인가, 핵심 키워드가 들어 있는가, **기록에 없는 말(진단명, 상담자 행동 등)이 나오는가**, 기록에 없는 숫자가 나오는가(경고), 빈 기록에서 AI를 부르지 않는가. 자동 검사는 키워드 기준이라 **사람의 눈 확인이 필요하다.** 보고서에 요약 원문을 같이 넣었다.

## 알려진 한계

- 이름은 자동으로 지울 수 없다. 이름 필드를 아는 백엔드가 요청 전에 `[내담자]` 같은 말로 바꾸는 것을 권한다.
- AI는 기록에 없는 상담자 행동("확인함", "안내함")을 가끔 만든다. 프롬프트로 줄였지만 없어지지 않는다. 그래서 상담사 검토와 승인이 필수다.
- 이전 실측(프롬프트 v3, 기록 10건, 30칸)에서 정답과 일치 23칸이었다. 자세한 문제는 `tests/KNOWN_ISSUES.md`.
- 프롬프트 v4로 실제 LLM 평가를 두 번 돌렸을 때 15개 중 1차는 통과 12(실패 C03, C09, C12), 2차는 통과 14(실패 C12)였다. **같은 입력이라도 결과가 달라질 수 있다.** C12(짧은 기록)는 두 번 다 호소 칸에 "사정 확인 중"을 넣어서 v5에서 "접수·사정 확인은 호소가 아니라 개입" 규칙과 예시를 추가했다. v5의 평가 결과는 `run_eval.py`로 확인한다 (v5 보완에 쓰지 않은 새 입력 C16~C18 포함).
- 응답 시간은 보통 1~3초이지만 첫 호출이나 긴 기록에서 5초 이상(최대 23초)이 나온 적이 있다. 백엔드 응답 대기는 30초 이상을 권한다.
