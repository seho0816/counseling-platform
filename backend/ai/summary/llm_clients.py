"""LLM 호출부. 서비스는 generate(system, user)만 안다. 모델을 바꾸면 이 파일만 바꾼다."""
import os
import re

from summary_core import (AiAuthError, AiInvalidResponseError, AiModelNotFoundError,
                          AiRateLimitError, AiUnavailableError, NotConfiguredError, SummaryError)

DEFAULT_MODEL = "gemini-3.5-flash-lite"


def classify_exception(e):
    """라이브러리 예외를 우리 오류로 바꾼다 (메시지 문구로 구분)."""
    msg = str(e)
    low = msg.lower()
    if "429" in msg or "resource_exhausted" in low or "quota" in low:
        m = re.search(r"retry in ([\d.]+)\s*s", low) or re.search(r"retrydelay['\"]?:\s*['\"]?(\d+)s", low)
        return AiRateLimitError("AI 호출 한도 초과", retry_after=float(m.group(1)) if m else None)
    if any(k in low for k in ("401", "403", "permission_denied", "unauthenticated", "api key not valid", "api_key_invalid")):
        return AiAuthError("API 키가 없거나 권한이 없습니다 (무료 등급을 쓸 수 없는 프로젝트일 수 있음)")
    if "404" in msg or "not found" in low:
        return AiModelNotFoundError("모델 이름을 찾을 수 없습니다")
    return AiUnavailableError("AI 서비스에 연결하지 못했습니다")


class GeminiClient:
    def __init__(self, api_key=None, model=None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise NotConfiguredError("GEMINI_API_KEY 환경 변수가 없습니다")
        self.model = model or os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
        try:
            from google import genai
        except ImportError:
            raise NotConfiguredError("google-genai가 설치되어 있지 않습니다: pip install google-genai")
        self._client = genai.Client(api_key=self.api_key)

    def generate(self, system, user):
        try:
            resp = self._client.models.generate_content(
                model=self.model, contents=user,
                config={"system_instruction": system, "temperature": 0})
            text = resp.text
        except SummaryError:
            raise
        except Exception as e:
            raise classify_exception(e) from e
        if not text:
            raise AiInvalidResponseError("AI가 빈 응답을 돌려줌")
        return text


class FakeClient:
    """시험용. 미리 정한 응답(문자열) 또는 예외를 차례로 돌려주고, 마지막 항목은 반복한다."""
    model = "fake"

    def __init__(self, *steps):
        self.steps = list(steps)
        self.calls = []

    def generate(self, system, user):
        self.calls.append(user)
        step = self.steps[min(len(self.calls) - 1, len(self.steps) - 1)]
        if isinstance(step, Exception):
            raise step
        return step
