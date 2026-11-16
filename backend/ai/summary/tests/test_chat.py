"""안내 챗봇(chat_core, /api/ai/chat) 단위 시험. Gemini를 부르지 않는다(가짜 클라이언트)."""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import chat_core  # noqa: E402
from chat_core import ChatService, DISCLAIMER, EmptyMessageError, MessageTooLongError, detect_crisis  # noqa: E402
from llm_clients import FakeClient  # noqa: E402
from server import make_server  # noqa: E402
from summary_core import AiInvalidResponseError, AiRateLimitError, AiUnavailableError  # noqa: E402

CRISIS_SAMPLES = ["죽고 싶다", "요즘 너무 힘들어서 죽고싶어요", "살기 싫어요", "그냥 사라지고 싶다", "다 끝내고 싶어요",
                  "더는 못 버티겠어요", "더 이상 못 버티겠어요", "나를 해치고 싶은 생각이 들어요", "누군가를 해치고 싶어요",
                  "죽 고 싶 다", "죽고싶다!!!", "자살하고 싶어요", "자해를 했어요", "목숨을 끊고 싶어요",
                  "극단적 선택을 생각해요", "죽을 것 같아요", "스스로를 해치고 싶어요"]
EVERYDAY = ["배고파 죽겠어요", "더워 죽겠다", "시험 때문에 죽을 맛이에요", "죽 먹고 싶어요", "운영 시간이 어떻게 되나요",
            "약 먹어도 돼요?", "상담을 대신 해 주세요", "초기 질문지는 어디서 작성하나요", "목숨 걸고 공부했어요"]


def reply(answer_type="ANSWER", answer="운영 시간은 평일 09:00~18:00입니다."):
    return json.dumps({"answerType": answer_type, "answer": answer}, ensure_ascii=False)


def service(*steps, **kw):
    client = FakeClient(*(steps or [reply()]))
    return ChatService(client, sleep=lambda s: None, **kw), client


class ChatServiceTest(unittest.TestCase):
    def test_기본_프롬프트와_기관_자료가_읽힌다(self):
        svc, _ = service()
        self.assertIn("유한마음돌봄센터", svc.system)
        self.assertNotIn(chat_core.KNOWLEDGE_PLACEHOLDER, svc.system)
        self.assertEqual(svc.phone, "02-0000-0000")

    def test_위기_표현은_AI를_부르지_않고_CRISIS로_돌려준다(self):
        for text in CRISIS_SAMPLES:
            svc, client = service()
            result = svc.answer(text)
            self.assertEqual(result["answerType"], "CRISIS", text)
            self.assertEqual(result["reply"], "")
            self.assertFalse(result["aiGenerated"])
            self.assertEqual(client.calls, [], text)

    def test_일상_표현은_위기로_보지_않는다(self):
        for text in EVERYDAY:
            self.assertFalse(detect_crisis(text), text)

    def test_정상_응답에_안내_문구가_붙는다(self):
        svc, client = service()
        result = svc.answer("운영 시간이 어떻게 되나요?")
        self.assertEqual(result["answerType"], "ANSWER")
        self.assertTrue(result["reply"].endswith(DISCLAIMER))
        self.assertTrue(result["aiGenerated"])
        self.assertFalse(result["guarded"])
        self.assertEqual(result["model"], "fake")
        self.assertEqual(result["promptVersion"], "v1")
        self.assertEqual(len(client.calls), 1)

    def test_개인정보는_AI로_보내기_전에_가려진다(self):
        svc, client = service()
        svc.answer("연락처는 010-1234-5678이고 메일은 tester@example.com이에요. 운영 시간이 궁금해요")
        sent = client.calls[0]
        self.assertNotIn("010-1234-5678", sent)
        self.assertNotIn("tester@example.com", sent)

    def test_빈_질문과_너무_긴_질문은_거절한다(self):
        svc, client = service()
        for bad in ("", "   ", None, 123):
            with self.assertRaises(EmptyMessageError):
                svc.answer(bad)
        with self.assertRaises(MessageTooLongError):
            svc.answer("가" * (chat_core.max_message_chars() + 1))
        self.assertEqual(client.calls, [])

    def test_JSON이_아니거나_유형이_틀리면_한_번_더_시도한_뒤_오류(self):
        svc, client = service("그냥 글입니다", "그냥 글입니다")
        with self.assertRaises(AiInvalidResponseError):
            svc.answer("운영 시간이 어떻게 되나요?")
        self.assertEqual(len(client.calls), 2)
        svc, _ = service(reply("MAYBE", "답"), reply("MAYBE", "답"))
        with self.assertRaises(AiInvalidResponseError):
            svc.answer("운영 시간이 어떻게 되나요?")

    def test_첫_응답이_이상해도_두_번째가_정상이면_성공한다(self):
        svc, client = service("그냥 글입니다", reply())
        self.assertEqual(svc.answer("운영 시간이 어떻게 되나요?")["answerType"], "ANSWER")
        self.assertEqual(len(client.calls), 2)

    def test_한도와_연결_오류는_그대로_전달한다(self):
        svc = ChatService(FakeClient(AiRateLimitError("한도", retry_after=1)), max_retries=0, sleep=lambda s: None)
        with self.assertRaises(AiRateLimitError):
            svc.answer("운영 시간이 어떻게 되나요?")
        svc = ChatService(FakeClient(AiUnavailableError("연결 실패")), max_retries=0, sleep=lambda s: None)
        with self.assertRaises(AiUnavailableError):
            svc.answer("운영 시간이 어떻게 되나요?")

    # ---- 출력 검사 ----
    def _guarded(self, answer, message="질문입니다"):
        svc, _ = service(reply("ANSWER", answer))
        result = svc.answer(message)
        return result

    def test_지침을_그대로_말하면_고정_안내로_바꾼다(self):
        leaked = "기관 자료에 있는 내용만 쓴다. 숫자, 시간, 연락처, 이름도 자료에 적힌 그대로만 쓴다."
        result = self._guarded(leaked)
        self.assertTrue(result["guarded"])
        self.assertEqual(result["answerType"], "NOT_IN_INFO")
        self.assertIn("02-0000-0000", result["reply"])
        self.assertTrue(result["reply"].endswith(DISCLAIMER))
        self.assertNotIn("숫자, 시간", result["reply"])

    def test_허용되지_않는_말은_고정_안내로_바꾼다(self):
        for bad in ("홈페이지에서 상담 신청을 하실 수 있어요.", "기관 상담자에게 연결해 드릴 수 있습니다.",
                    "저는 상담을 대신할 수 있는 챗봇이에요.", "answerType은 ANSWER입니다."):
            self.assertTrue(self._guarded(bad)["guarded"], bad)

    def test_자료에_없는_숫자는_고정_안내로_바꾼다(self):
        self.assertTrue(self._guarded("상담은 30분 동안 진행돼요.")["guarded"])
        self.assertFalse(self._guarded("개인 상담은 1회 50분이고 예약제예요.")["guarded"])

    def test_사용자가_말한_숫자는_답에_써도_된다(self):
        self.assertFalse(self._guarded("15살이시면 청소년 상담을 받으실 수 있어요.", "저는 15살인데 상담 가능해요?")["guarded"])

    def test_허용된_문구와_좋은_답은_걸리지_않는다(self):
        good = ["정해진 안내가 없어요. 기관 상담자에게 확인해 주세요. 기관 상담 연락처는 02-0000-0000입니다.",
                "진단은 이 챗봇이 할 수 없는 일이에요. 약이나 치료는 의사나 약사 같은 의료진과 상의해 주세요. "
                "상담을 원하시면 기관 상담 연락처 02-0000-0000으로 문의해 주세요.",
                "상담 신청 절차를 안내해 드릴게요.\n1단계 상담 신청서와 초기 질문지를 작성한다.\n"
                "2단계 개인정보 수집 동의서를 작성한다 (청소년은 보호자 동의서도 필요).\n3단계 담당 상담자가 배정된다.\n"
                "4단계 담당 상담자가 1회기 일정을 안내한다.",
                "초기 질문지에는 상담 받고 싶은 분야, 희망 시간대, 이전 상담 경험 여부, 연락 방법 선호, 연락처를 적어 주세요."]
        for text in good:
            self.assertFalse(self._guarded(text)["guarded"], text)


class ChatServerTest(unittest.TestCase):
    def _start(self, svc, token="tok"):
        server = make_server(lambda: None, "127.0.0.1", 0, token, chat_factory=lambda: svc)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server.server_address[1]

    def _post(self, port, body, token=None, path="/api/ai/chat", raw=None):
        data = raw if raw is not None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json; charset=utf-8"}
        if token:
            headers["X-AI-Token"] = token
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=data, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8"))

    def test_토큰이_있어야_챗봇_API를_쓸_수_있다(self):
        svc, client = service()
        port = self._start(svc)
        self.assertEqual(self._post(port, {"message": "운영 시간"})[0], 401)
        self.assertEqual(self._post(port, {"message": "운영 시간"}, "wrong")[0], 401)
        self.assertEqual(client.calls, [])
        status, body = self._post(port, {"message": "운영 시간이 어떻게 되나요?"}, "tok")
        self.assertEqual(status, 200)
        self.assertEqual(list(body.keys()), ["reply"])  # 계약: {"reply": "..."}만 돌려준다
        self.assertTrue(body["reply"].endswith(DISCLAIMER))

    def test_시험용_환경변수를_켜면_부가_정보도_돌려준다(self):
        svc, _ = service()
        port = self._start(svc, token=None)
        with mock.patch.dict(os.environ, {"AI_CHAT_META": "1"}):
            status, body = self._post(port, {"message": "운영 시간이 어떻게 되나요?"})
        self.assertEqual((status, body["answerType"], body["aiGenerated"]), (200, "ANSWER", True))
        self.assertIn("reply", body)

    def test_잘못된_요청은_400과_413이다(self):
        svc, client = service()
        port = self._start(svc, token=None)
        status, body = self._post(port, {"text": "x"})
        self.assertEqual((status, body["error"]), (400, "INVALID_REQUEST"))
        status, body = self._post(port, {"message": "   "})
        self.assertEqual((status, body["error"]), (400, "EMPTY_MESSAGE"))
        status, body = self._post(port, {"message": "가" * 501})
        self.assertEqual((status, body["error"]), (413, "MESSAGE_TOO_LONG"))
        status, body = self._post(port, None, raw=b"not json")
        self.assertEqual((status, body["error"]), (400, "INVALID_REQUEST"))
        self.assertEqual(client.calls, [])

    def test_위기_표현은_서버에서도_AI를_부르지_않는다(self):
        svc, client = service()
        port = self._start(svc, token=None)
        status, body = self._post(port, {"message": "더는 못 버티겠어요"})
        self.assertEqual((status, body["error"], body["manualInput"]), (422, "CRISIS_DETECTED", True))
        self.assertNotIn("reply", body)
        self.assertEqual(client.calls, [])

    def test_AI_오류는_요약과_같은_형식으로_돌려준다(self):
        svc = ChatService(FakeClient(AiUnavailableError("연결 실패")), max_retries=0, sleep=lambda s: None)
        port = self._start(svc, token=None)
        status, body = self._post(port, {"message": "운영 시간이 어떻게 되나요?"})
        self.assertEqual((status, body["error"], body["manualInput"]), (502, "AI_UNAVAILABLE", True))


if __name__ == "__main__":
    unittest.main()
