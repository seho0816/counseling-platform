"""API 키 없이 돌리는 시험 (가짜 클라이언트). 실행: py -m unittest discover -s tests -v"""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import summary_core as core  # noqa: E402
from summary_core import (AiAuthError, AiInvalidResponseError, AiRateLimitError, AiUnavailableError,  # noqa: E402
                          EmptyRecordError, NotConfiguredError, RecordTooLongError, SummaryService)
from llm_clients import FakeClient, GeminiClient, classify_exception, load_dotenv  # noqa: E402
from server import make_server  # noqa: E402
import run_eval  # noqa: E402

GOOD = '{"complaint":"a","intervention":"b","nextPlan":"c"}'


def service(*steps, sleeps=None):
    client = FakeClient(*steps)
    rec = [] if sleeps is None else sleeps
    return SummaryService(client, prompt_text="p", sleep=rec.append), client


class SummaryServiceTest(unittest.TestCase):
    def test_정상_응답은_세_필드와_초안_표시를_돌려준다(self):
        s, _ = service(GOOD)
        r = s.summarize("기록")
        self.assertEqual((r["complaint"], r["intervention"], r["nextPlan"]), ("a", "b", "c"))
        self.assertEqual((r["status"], r["aiGenerated"], r["reviewRequired"]), ("DRAFT", True, True))

    def test_코드블록으로_감싼_JSON도_읽는다(self):
        s, _ = service("```json\n" + GOOD + "\n```")
        self.assertEqual(s.summarize("기록")["nextPlan"], "c")

    def test_필드가_빠지면_한번_더_시도한다(self):
        s, c = service('{"complaint":"a","intervention":"b"}', GOOD)
        self.assertEqual(s.summarize("기록")["complaint"], "a")
        self.assertEqual(len(c.calls), 2)

    def test_계속_잘못된_응답이면_수동_입력을_안내한다(self):
        s, c = service("죄송합니다")
        with self.assertRaises(AiInvalidResponseError) as cm:
            s.summarize("기록")
        self.assertTrue(cm.exception.manual_input)
        self.assertEqual(len(c.calls), 2)

    def test_빈_기록은_AI를_부르지_않는다(self):
        for bad in ("", "   \n\t ", None, 123):
            s, c = service(GOOD)
            with self.assertRaises(EmptyRecordError):
                s.summarize(bad)
            self.assertEqual(len(c.calls), 0)

    def test_너무_긴_기록은_거절한다(self):
        s, c = service(GOOD)
        with mock.patch.dict(os.environ, {"AI_MAX_RECORD_CHARS": "10"}):
            with self.assertRaises(RecordTooLongError):
                s.summarize("가" * 11)
        self.assertEqual(len(c.calls), 0)

    def test_한도_초과는_알려준_시간만큼_기다렸다_다시_시도한다(self):
        sleeps = []
        s, c = service(AiRateLimitError("q", retry_after=12), GOOD, sleeps=sleeps)
        self.assertEqual(s.summarize("기록")["complaint"], "a")
        self.assertEqual(sleeps, [12])

    def test_한도_초과가_계속되면_대기_시간을_알려준다(self):
        s, _ = service(AiRateLimitError("q", retry_after=7))
        with self.assertRaises(AiRateLimitError) as cm:
            s.summarize("기록")
        self.assertEqual(cm.exception.to_dict()["retryAfterSeconds"], 7)

    def test_키_오류는_다시_시도하지_않는다(self):
        s, c = service(AiAuthError("403"))
        with self.assertRaises(AiAuthError):
            s.summarize("기록")
        self.assertEqual(len(c.calls), 1)

    def test_서버_오류는_한번만_다시_시도한다(self):
        s, c = service(AiUnavailableError("503"))
        with self.assertRaises(AiUnavailableError):
            s.summarize("기록")
        self.assertEqual(len(c.calls), 2)

    def test_예상_밖_예외도_AI_장애로_처리한다(self):
        s, _ = service(RuntimeError("boom"))
        with self.assertRaises(AiUnavailableError):
            s.summarize("기록")

    def test_전화번호_이메일_주민번호는_AI에_보내기_전에_가린다(self):
        s, c = service(GOOD)
        s.summarize("연락처 010-1234-5678 메일 a.b@test.com 번호 900101-1234567 날짜 2026-09-02")
        sent = c.calls[0]
        for secret in ("010-1234-5678", "a.b@test.com", "900101-1234567"):
            self.assertNotIn(secret, sent)
        self.assertIn("2026-09-02", sent)

    def test_키가_없으면_시작할_때_알려준다(self):
        with mock.patch.dict(os.environ, {"AI_ENV_FILE": os.path.join(HERE, "no_such.env")}, clear=True):
            with self.assertRaises(NotConfiguredError):
                GeminiClient()

    def test_env_파일에서_키를_읽되_이미_있는_환경_변수는_덮어쓰지_않는다(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, ".env")
            with open(path, "w", encoding="utf-8") as f:
                f.write('# 주석\r\nGEMINI_API_KEY="abc123"\r\nGEMINI_MODEL=m1\r\n\r\nBAD LINE\r\nEMPTY=\r\n')
            with mock.patch.dict(os.environ, {"GEMINI_MODEL": "keep"}, clear=True):
                self.assertTrue(load_dotenv(path))
                self.assertEqual(os.environ["GEMINI_API_KEY"], "abc123")
                self.assertEqual(os.environ["GEMINI_MODEL"], "keep")
                self.assertNotIn("EMPTY", os.environ)

    def test_env_파일이_없으면_조용히_넘어간다(self):
        self.assertFalse(load_dotenv(os.path.join(HERE, "no_such.env")))

    def test_클라이언트가_env_파일의_키를_쓴다(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, ".env")
            with open(path, "w", encoding="utf-8") as f:
                f.write("GEMINI_API_KEY=from-file\n")
            with mock.patch.dict(os.environ, {"AI_ENV_FILE": path}, clear=True):
                try:
                    c = GeminiClient()
                except NotConfiguredError:
                    return  # google-genai가 없는 환경이면 키 읽기까지만 확인
                self.assertEqual(c.api_key, "from-file")

    def test_이름은_긴_것부터_가리고_한_글자는_무시한다(self):
        self.assertEqual(core.mask_terms("김하늘은 하늘을 봤다. 김하늘 님", ["하늘", "김하늘", "가"]), "[이름]은 [이름]을 봤다. [이름] 님")
        self.assertEqual(core.mask_terms("가나다", ["가"]), "가나다")
        self.assertEqual(core.mask_terms("그대로", None), "그대로")
        self.assertEqual(core.mask_terms("그대로", ["", "  ", 5, None]), "그대로")

    def test_이름과_전화번호를_모두_가린_뒤_AI에_보낸다(self):
        s, c = service(GOOD)
        s.summarize("김하늘 내담자 연락처 010-1234-5678", ["김하늘"])
        self.assertNotIn("김하늘", c.calls[0])
        self.assertNotIn("010-1234-5678", c.calls[0])
        self.assertIn("[이름]", c.calls[0])

    def test_예상_밖_예외_문구에_기록_내용이_섞여도_오류에는_나오지_않는다(self):
        s, _ = service(RuntimeError("요청 본문: 김하늘 내담자 기록"))
        with self.assertRaises(AiUnavailableError) as cm:
            s.summarize("김하늘 내담자 기록")
        self.assertNotIn("김하늘", cm.exception.message)
        self.assertNotIn("김하늘", str(cm.exception.to_dict()))

    def test_실제_오류_문구를_분류한다(self):
        self.assertIsInstance(classify_exception(Exception("403 PERMISSION_DENIED. The Gemini API free tier is not available")), AiAuthError)
        self.assertIsInstance(classify_exception(Exception("404 Not Found. {'status': 'Not Found'}")), core.AiModelNotFoundError)
        e = classify_exception(Exception("429 RESOURCE_EXHAUSTED. Please retry in 40.5s"))
        self.assertIsInstance(e, AiRateLimitError)
        self.assertEqual(round(e.retry_after), 40)
        self.assertIsInstance(classify_exception(Exception("connection reset")), AiUnavailableError)

    def test_프롬프트는_새_필드_이름을_쓴다(self):
        p = core.load_prompt()
        for name in ("complaint", "intervention", "nextPlan"):
            self.assertIn(name, p)
        self.assertNotIn("chief_complaint", p)
        self.assertNotIn("next_plan", p)


    def test_프롬프트_버전은_파일_이름에서_읽는다(self):
        base = os.path.join(HERE, "..", "prompts")
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("AI_PROMPT_FILE", None)
            self.assertEqual(core.prompt_version(), "v5")
            os.environ["AI_PROMPT_FILE"] = os.path.join(base, "summary_prompt_v6.txt")
            self.assertEqual(core.prompt_version(), "v6")
            os.environ["AI_PROMPT_FILE"] = "other.txt"
            self.assertEqual(core.prompt_version(), "custom")

    def test_프롬프트에_접수는_호소가_아니라는_규칙이_있고_v6은_규칙이_더_있다(self):
        base = os.path.join(os.path.dirname(HERE), "prompts")
        v5 = open(os.path.join(base, "summary_prompt_v5.txt"), encoding="utf-8").read()
        v6 = open(os.path.join(base, "summary_prompt_v6.txt"), encoding="utf-8").read()
        for p in (v5, v6):
            self.assertIn("complaint에 쓰지 않는다", p)
            self.assertIn("접수", p)
        self.assertIn("경청함", v6)
        self.assertNotIn("경청함", v5)
        s, _ = service(GOOD)
        self.assertEqual(s.summarize("기록")["promptVersion"], core.PROMPT_VERSION)

    def test_한도_뒤_기다리는_시간은_상한이_있다(self):
        sleeps = []
        s, _ = service(AiRateLimitError("q", retry_after=50), GOOD, sleeps=sleeps)
        s.summarize("기록")
        self.assertEqual(sleeps, [core.MAX_RETRY_WAIT])


class EvalToolTest(unittest.TestCase):
    CASE = {"record": "친구가 없다고 함 3주", "expect": {"include": {"complaint": [["친구"]]}, "forbid": ["우울증"], "none_fields": ["nextPlan"]}}

    def ok(self, **kw):
        base = {"complaint": "친구가 없음", "intervention": "x", "nextPlan": "기록에 없음"}
        base.update(kw)
        return base

    def test_정상은_통과(self):
        self.assertEqual(run_eval.evaluate_case(self.CASE, self.ok(), True)[0], "PASS")

    def test_지어낸_말은_실패(self):
        v, n = run_eval.evaluate_case(self.CASE, self.ok(intervention="우울증으로 보임"), True)
        self.assertEqual(v, "FAIL")

    def test_없어야_할_내용이_채워지면_실패(self):
        self.assertEqual(run_eval.evaluate_case(self.CASE, self.ok(nextPlan="다음 주"), True)[0], "FAIL")

    def test_핵심_내용이_빠지면_실패(self):
        self.assertEqual(run_eval.evaluate_case(self.CASE, self.ok(complaint="모름"), True)[0], "FAIL")

    def test_기록에_없는_숫자는_경고(self):
        self.assertEqual(run_eval.evaluate_case(self.CASE, self.ok(intervention="7회"), True)[0], "WARN")

    def test_호소_칸에_들어가면_안_되는_말을_잡는다(self):
        case = {"record": "첫 내방", "expect": {"forbid_fields": {"complaint": ["질문지"]}}}
        ok = {"complaint": "직장 일", "intervention": "x", "nextPlan": "y"}
        bad = {"complaint": "질문지 작성", "intervention": "x", "nextPlan": "y"}
        self.assertEqual(run_eval.evaluate_case(case, ok, True)[0], "PASS")
        self.assertEqual(run_eval.evaluate_case(case, bad, True)[0], "FAIL")

    def test_항목이_너무_길면_경고(self):
        case = {"record": "기록", "expect": {"max_len": 10}}
        long_out = {"complaint": "가" * 11, "intervention": "x", "nextPlan": "y"}
        v, notes = run_eval.evaluate_case(case, long_out, True)
        self.assertEqual(v, "WARN")
        self.assertIn("complaint", notes[0])
        self.assertEqual(run_eval.evaluate_case(case, {"complaint": "a", "intervention": "x", "nextPlan": "y"}, True)[0], "PASS")

    def test_한_시간을_1시간으로_쓴_것은_지어낸_숫자로_보지_않는다(self):
        case = {"record": "잠드는 데 한 시간 넘게 걸린다고 함", "expect": {}}
        self.assertEqual(run_eval.evaluate_case(case, {"complaint": "1시간 넘게 걸림", "intervention": "x", "nextPlan": "y"}, True)[0], "PASS")
        self.assertEqual(run_eval.evaluate_case(case, {"complaint": "3시간 넘게 걸림", "intervention": "x", "nextPlan": "y"}, True)[0], "WARN")

    def test_중요한_정보가_빠지면_실패(self):
        case = {"record": "기록", "expect": {"keep": [["약물", "처방"]]}}
        self.assertEqual(run_eval.evaluate_case(case, {"complaint": "불안", "intervention": "x", "nextPlan": "y"}, True)[0], "FAIL")
        self.assertEqual(run_eval.evaluate_case(case, {"complaint": "약 처방을 받음", "intervention": "x", "nextPlan": "y"}, True)[0], "PASS")

    def test_빈_기록에서_AI를_부르면_실패(self):
        case = {"record": "", "expect": {"error": "EMPTY_RECORD", "llm_called": False}}
        self.assertEqual(run_eval.evaluate_case(case, {"error": "EMPTY_RECORD"}, True)[0], "FAIL")
        self.assertEqual(run_eval.evaluate_case(case, {"error": "EMPTY_RECORD"}, False)[0], "PASS")


class ServerTest(unittest.TestCase):
    def start(self, svc):
        server = make_server(lambda: svc, "127.0.0.1", 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server.server_address[1]

    def post(self, port, body, path="/api/ai/summary"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8"))

    def test_정상_요청(self):
        s, _ = service(GOOD)
        status, body = self.post(self.start(s), {"recordText": "내담자 기록"})
        self.assertEqual(status, 200)
        self.assertEqual(body["nextPlan"], "c")
        self.assertEqual(body["status"], "DRAFT")

    def test_빈_기록은_400(self):
        s, c = service(GOOD)
        status, body = self.post(self.start(s), {"recordText": "  "})
        self.assertEqual((status, body["error"], body["manualInput"]), (400, "EMPTY_RECORD", False))
        self.assertEqual(len(c.calls), 0)

    def test_본문이_JSON이_아니면_400(self):
        s, _ = service(GOOD)
        self.assertEqual(self.post(self.start(s), b"not json")[0], 400)

    def test_recordText가_없으면_400(self):
        s, _ = service(GOOD)
        self.assertEqual(self.post(self.start(s), {"text": "x"})[1]["error"], "INVALID_REQUEST")

    def test_AI_장애는_502와_수동_입력_안내(self):
        s, _ = service(AiUnavailableError("503"))
        status, body = self.post(self.start(s), {"recordText": "기록"})
        self.assertEqual((status, body["error"], body["manualInput"]), (502, "AI_UNAVAILABLE", True))

    def test_한도_초과는_429(self):
        s, _ = service(AiRateLimitError("q", retry_after=9))
        status, body = self.post(self.start(s), {"recordText": "기록"})
        self.assertEqual((status, body["error"], body["retryAfterSeconds"]), (429, "AI_RATE_LIMITED", 9))

    def test_maskTerms로_이름을_가려서_보낸다(self):
        s, c = service(GOOD)
        status, _ = self.post(self.start(s), {"recordText": "김하늘 내담자 기록", "maskTerms": ["김하늘"]})
        self.assertEqual(status, 200)
        self.assertNotIn("김하늘", c.calls[0])

    def test_maskTerms가_잘못되면_400(self):
        s, c = service(GOOD)
        port = self.start(s)
        for bad in ("김하늘", [1, 2], ["가" * 101], ["x"] * 51):
            status, body = self.post(port, {"recordText": "기록", "maskTerms": bad})
            self.assertEqual((status, body["error"]), (400, "INVALID_REQUEST"))
        self.assertEqual(len(c.calls), 0)

    def test_없는_주소는_404(self):
        s, _ = service(GOOD)
        self.assertEqual(self.post(self.start(s), {}, path="/nope")[0], 404)


if __name__ == "__main__":
    unittest.main()
