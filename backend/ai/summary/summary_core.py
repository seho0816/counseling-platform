"""상담 기록 AI 요약의 핵심 로직 (LLM 종류와 무관).

흐름: 기록 검사 -> 개인정보 마스킹 -> LLM 호출 -> JSON 검증 -> (실패 시 재시도) -> 초안(DRAFT) 반환
이 모듈은 저장하지 않는다. 결과는 항상 상담사의 검토와 승인이 필요한 초안이다.
"""
import json
import os
import re
import time

FIELDS = ("complaint", "intervention", "nextPlan")
NO_RECORD = "기록에 없음"
DEFAULT_MAX_CHARS = 20000
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROMPT_FILE = "summary_prompt_v5.txt"
MAX_RETRY_WAIT = 25  # 호출 한도(429) 뒤 기다리는 시간의 상한(초). 백엔드 대기 시간 안에 끝내려고 둔다


def prompt_path():
    return os.environ.get("AI_PROMPT_FILE") or os.path.join(HERE, "prompts", DEFAULT_PROMPT_FILE)


def prompt_version():
    """프롬프트 파일 이름(summary_prompt_v6.txt)에서 버전을 읽는다. 이름 형식이 다르면 'custom'."""
    m = re.search(r"summary_prompt_(v\d+)", os.path.basename(prompt_path()))
    return m.group(1) if m else "custom"


PROMPT_VERSION = prompt_version()


def max_chars():
    return int(os.environ.get("AI_MAX_RECORD_CHARS", DEFAULT_MAX_CHARS))


# ---- 오류 (백엔드가 code로 구분하고, manualInput이 true면 수동 입력 화면을 보여 준다) ----
class SummaryError(Exception):
    code = "AI_ERROR"
    http_status = 502
    manual_input = True

    def __init__(self, message="", retry_after=None):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.retry_after = retry_after

    def to_dict(self):
        d = {"error": self.code, "message": self.message, "manualInput": self.manual_input}
        if self.retry_after is not None:
            d["retryAfterSeconds"] = int(round(self.retry_after))
        return d


class EmptyRecordError(SummaryError):
    code, http_status, manual_input = "EMPTY_RECORD", 400, False


class RecordTooLongError(SummaryError):
    code, http_status, manual_input = "RECORD_TOO_LONG", 413, False


class NotConfiguredError(SummaryError):
    code, http_status = "AI_NOT_CONFIGURED", 500


class AiAuthError(SummaryError):
    code, http_status = "AI_AUTH_FAILED", 502


class AiModelNotFoundError(SummaryError):
    code, http_status = "AI_MODEL_NOT_FOUND", 502


class AiRateLimitError(SummaryError):
    code, http_status = "AI_RATE_LIMITED", 429


class AiUnavailableError(SummaryError):
    code, http_status = "AI_UNAVAILABLE", 502


class AiInvalidResponseError(SummaryError):
    code, http_status = "AI_INVALID_RESPONSE", 502


# ---- 개인정보 마스킹 (AI에 보내기 전). 이름은 자동으로 못 지운다. ----
_PII = [
    (re.compile(r"(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)"), "[주민등록번호]"),
    (re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), "[이메일]"),
    (re.compile(r"(?<!\d)0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)"), "[전화번호]"),
]


def mask_pii(text):
    for pattern, label in _PII:
        text = pattern.sub(label, text)
    return text


MAX_MASK_TERMS = 50


def mask_terms(text, terms):
    """백엔드가 알려 준 이름 등(terms)을 [이름]으로 바꾼다. 한 글자 용어는 무시한다(너무 많이 바뀌므로).
    긴 용어부터 바꿔서 '김하늘'과 '하늘'이 함께 있어도 안전하다."""
    cleaned = sorted({t.strip() for t in (terms or []) if isinstance(t, str) and len(t.strip()) >= 2},
                     key=len, reverse=True)[:MAX_MASK_TERMS]
    for term in cleaned:
        text = text.replace(term, "[이름]")
    return text


# ---- 응답 검증 ----
def parse_summary(raw):
    """AI 응답 문자열 -> {complaint, intervention, nextPlan}. 이상하면 AiInvalidResponseError."""
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise AiInvalidResponseError("응답에서 JSON 객체를 찾을 수 없음")
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        raise AiInvalidResponseError("응답을 JSON으로 읽을 수 없음")
    if not isinstance(data, dict):
        raise AiInvalidResponseError("JSON 객체가 아님")
    out = {}
    for f in FIELDS:
        v = data.get(f)
        if not isinstance(v, str) or not v.strip():
            raise AiInvalidResponseError("필드 누락 또는 빈 값: " + f)
        out[f] = v.strip()
    return out


def load_prompt():
    path = prompt_path()
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        raise NotConfiguredError("프롬프트 파일을 읽을 수 없음: " + path)


class SummaryService:
    def __init__(self, client, prompt_text=None, max_retries=1, sleep=time.sleep):
        self.client = client
        self.prompt = prompt_text if prompt_text is not None else load_prompt()
        self.max_retries = max_retries
        self.sleep = sleep

    def summarize(self, record_text, terms=None):
        if not isinstance(record_text, str) or not record_text.strip():
            raise EmptyRecordError("상담 기록이 비어 있습니다")
        text = record_text.strip()
        if len(text) > max_chars():
            raise RecordTooLongError("상담 기록이 너무 깁니다 (최대 %d자)" % max_chars())
        masked = mask_pii(mask_terms(text, terms))
        last = None
        for attempt in range(self.max_retries + 1):
            try:
                data = parse_summary(self.client.generate(self.prompt, masked))
            except AiRateLimitError as e:
                last = e
                if attempt < self.max_retries:
                    self.sleep(min(e.retry_after or 20, MAX_RETRY_WAIT))
                    continue
                raise
            except (AiInvalidResponseError, AiUnavailableError) as e:
                last = e
                if attempt < self.max_retries:
                    self.sleep(1)
                    continue
                raise
            except SummaryError:
                raise  # 키·모델·설정 문제는 다시 해도 소용없다
            except Exception as e:  # 예상 밖 오류는 AI 장애로 취급
                last = AiUnavailableError("AI 호출 중 알 수 없는 오류가 발생했습니다")  # 예외 문구에 기록이 섞일 수 있어 쓰지 않는다
                if attempt < self.max_retries:
                    self.sleep(1)
                    continue
                raise last
            return {
                "complaint": data["complaint"],
                "intervention": data["intervention"],
                "nextPlan": data["nextPlan"],
                "status": "DRAFT",
                "aiGenerated": True,
                "reviewRequired": True,
                "model": getattr(self.client, "model", "unknown"),
                "promptVersion": PROMPT_VERSION,
            }
        raise last
