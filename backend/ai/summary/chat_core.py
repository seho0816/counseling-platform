"""기관 안내 챗봇의 핵심 로직 (LLM 종류와 무관).

흐름: 입력 검사 -> 위기 표현 확인(걸리면 AI를 부르지 않음) -> 개인정보 마스킹 -> LLM 호출 -> JSON 검증
      -> 출력 검사(지침 노출, 허용 안 되는 말, 자료에 없는 숫자) -> 안내 문구 붙이기
이 모듈은 저장하지 않는다. 한 번에 한 질문만 받고 대화 기록은 쓰지 않는다.
위기 표현의 고정 문구는 백엔드(Spring Boot)가 정한다. 여기서는 걸러서 CRISIS 유형만 돌려주고, 서버(server.py)는 이를 422 CRISIS_DETECTED로 바꿔 백엔드가 고정 문구를 쓰게 한다.
"""
import json
import os
import re
import time

from summary_core import (AiInvalidResponseError, AiRateLimitError, AiUnavailableError, MAX_RETRY_WAIT,
                          SummaryError, mask_pii)

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CHAT_PROMPT_FILE = "chat_prompt_v1.txt"
DEFAULT_KNOWLEDGE_FILE = "institution_v1.txt"
KNOWLEDGE_PLACEHOLDER = "(여기에 승인된 기관 안내 정보가 들어간다)"
KNOWLEDGE_MARKER = "[기관 자료]"
DEFAULT_MAX_MESSAGE_CHARS = 500
MAX_ANSWER_CHARS = 800
ANSWER_TYPES = ("ANSWER", "NOT_IN_INFO", "OUT_OF_SCOPE")
DISCLAIMER = "AI가 만든 안내이며 오류가 있을 수 있습니다"
SHINGLE = 16  # 지침의 16글자 이상이 그대로 답에 나오면 지침 노출로 본다

# 답변에 나오면 안 되는 말 (자료에 없는 접수 창구, 챗봇이 상담자와 연결해 준다는 말, 상담을 대신한다는 말, 내부 표시)
FORBIDDEN_IN_ANSWER = ("홈페이지", "웹사이트", "앱에서", "방문하여 신청", "방문해서 신청", "연결해 드", "직접 연결",
                       "상담을 대신할 수 있", "진단해 드", "처방", "[기관 자료]", "answerType", "NOT_IN_INFO",
                       "OUT_OF_SCOPE", "지침")

# 위기 표현 (공백과 문장부호를 없앤 글에서 찾는다). 위기를 놓치는 쪽이 오탐보다 위험하므로 넓게 잡았다.
# 최종 목록은 상담 전문가의 확인과 백엔드(Spring Boot)의 목록과 맞추어야 한다.
CRISIS_KEYWORDS = ("죽고싶", "죽을것", "자살", "자해", "사라지고싶", "사라져버리", "살기싫", "살고싶지않",
                   "극단적선택", "극단적인선택", "다끝내고싶", "다끝내버리고싶", "더는못버티", "더이상못버티",
                   "해치고싶", "목숨을끊", "목숨을버리")


def _normalize(text):
    return re.sub(r"[\s.,!?~\-_'\"()\[\]…]+", "", text or "").lower()


def detect_crisis(text):
    n = _normalize(text)
    return any(k in n for k in CRISIS_KEYWORDS)


def chat_prompt_path():
    return os.environ.get("AI_CHAT_PROMPT_FILE") or os.path.join(HERE, "prompts", DEFAULT_CHAT_PROMPT_FILE)


def knowledge_path():
    return os.environ.get("AI_CHAT_KNOWLEDGE_FILE") or os.path.join(HERE, "knowledge", DEFAULT_KNOWLEDGE_FILE)


def chat_prompt_version():
    m = re.search(r"chat_prompt_(v\d+)", os.path.basename(chat_prompt_path()))
    return m.group(1) if m else "custom"


def knowledge_version():
    m = re.search(r"_(v\d+)\.", os.path.basename(knowledge_path()))
    return m.group(1) if m else "custom"


def max_message_chars():
    return int(os.environ.get("AI_MAX_MESSAGE_CHARS", DEFAULT_MAX_MESSAGE_CHARS))


class EmptyMessageError(SummaryError):
    code, http_status, manual_input = "EMPTY_MESSAGE", 400, False


class MessageTooLongError(SummaryError):
    code, http_status, manual_input = "MESSAGE_TOO_LONG", 413, False


class NotConfiguredError(SummaryError):
    code, http_status, manual_input = "AI_NOT_CONFIGURED", 503, True


def _read(path, label):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        raise NotConfiguredError("%s 파일을 읽을 수 없음: %s" % (label, os.path.basename(path)))


def parse_chat(raw):
    """AI 응답 문자열 -> (answerType, answer). 이상하면 AiInvalidResponseError."""
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
    answer_type, answer = data.get("answerType"), data.get("answer")
    if answer_type not in ANSWER_TYPES:
        raise AiInvalidResponseError("answerType이 올바르지 않음")
    if not isinstance(answer, str) or not answer.strip():
        raise AiInvalidResponseError("answer가 비었음")
    return answer_type, answer.strip()


def _rules_text(prompt_text):
    """지침 중 [기관 자료] 앞부분에서 큰따옴표 안의 허용된 문구를 뺀 글. 지침 노출 검사에 쓴다."""
    head = prompt_text.split(KNOWLEDGE_MARKER)[0]
    return re.sub(r'"[^"\n]*"', "", head)


def _shingles(text, n=SHINGLE):
    t = re.sub(r"\s+", "", text)
    return {t[i:i + n] for i in range(0, max(len(t) - n + 1, 0))}


def _digit_runs(text):
    return set(re.findall(r"\d+", text or ""))


class ChatService:
    def __init__(self, client, prompt_text=None, knowledge_text=None, max_retries=1, sleep=time.sleep):
        self.client = client
        prompt = prompt_text if prompt_text is not None else _read(chat_prompt_path(), "챗봇 프롬프트")
        self.knowledge = knowledge_text if knowledge_text is not None else _read(knowledge_path(), "기관 안내 자료")
        self.system = prompt.replace(KNOWLEDGE_PLACEHOLDER, self.knowledge)
        # 지침 문장 중 기관 자료에도 있는 부분(프로그램 설명 등)은 답에 써도 되므로 뺀다
        self._rule_shingles = _shingles(_rules_text(prompt)) - _shingles(self.knowledge)
        self._allowed_digits = _digit_runs(self.knowledge)
        phone = re.search(r"\d{2,4}-\d{3,4}-\d{4}", self.knowledge)
        self.phone = phone.group(0) if phone else None
        self.max_retries = max_retries
        self.sleep = sleep

    # ---- 출력 검사: 문제가 있으면 이유(내부용)를 돌려준다 ----
    def check_answer(self, answer, message):
        if len(answer) > MAX_ANSWER_CHARS:
            return "too_long"
        for bad in FORBIDDEN_IN_ANSWER:
            if bad in answer:
                return "forbidden_phrase"
        if self._rule_shingles & _shingles(answer):
            return "rules_leak"
        allowed = self._allowed_digits | _digit_runs(message)
        if _digit_runs(answer) - allowed:
            return "number_not_in_info"
        return None

    def fallback_answer(self):
        text = "지금은 정확히 안내해 드리기 어려워요. 정확한 내용은 기관 상담자에게 확인해 주세요."
        if self.phone:
            text += " 기관 상담 연락처는 %s입니다." % self.phone
        return text

    def _result(self, answer_type, answer, ai_called, guarded=False):
        return {
            "reply": answer,
            "answerType": answer_type,
            "aiGenerated": ai_called,
            "guarded": guarded,
            "model": getattr(self.client, "model", "unknown") if ai_called else None,
            "promptVersion": chat_prompt_version(),
            "knowledgeVersion": knowledge_version(),
        }

    def answer(self, message):
        if not isinstance(message, str) or not message.strip():
            raise EmptyMessageError("질문이 비어 있습니다")
        text = message.strip()
        if len(text) > max_message_chars():
            raise MessageTooLongError("질문이 너무 깁니다 (최대 %d자)" % max_message_chars())
        if detect_crisis(text):
            # 문구는 백엔드가 정한 고정 문구를 쓴다. 여기서는 AI를 부르지 않고 유형만 알린다.
            return self._result("CRISIS", "", False)
        masked = mask_pii(text)
        last = None
        for attempt in range(self.max_retries + 1):
            try:
                answer_type, answer = parse_chat(self.client.generate(self.system, masked))
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
                raise
            except Exception:
                last = AiUnavailableError("AI 호출 중 알 수 없는 오류가 발생했습니다")
                if attempt < self.max_retries:
                    self.sleep(1)
                    continue
                raise last
            if self.check_answer(answer, text) is not None:
                return self._result("NOT_IN_INFO", self.fallback_answer() + "\n\n" + DISCLAIMER, True, guarded=True)
            return self._result(answer_type, answer + "\n\n" + DISCLAIMER, True)
        raise last
