"""실제 Gemini로 AI 요약 서버 전체를 검증한다 (서버를 직접 띄워 HTTP로 호출한다).

사용법 (backend/ai/summary 폴더에서)
  python tests/live_check.py          # 실제 Gemini 호출 (키 필요: GEMINI_API_KEY 또는 이 폴더의 .env), 약 1~2분
  python tests/live_check.py --fake   # 키 없이 도구만 점검 (가짜 응답이므로 Gemini 검증이 아니다)
  python tests/live_check.py --extra   # 네트워크 오류와 호출 한도(429)를 실제 호출 경로로 확인 (1~3분, 한도에 일부러 닿는다)
결과: eval_output/live_check_report.md, live_check_results.csv
무료 한도(분당 15회) 때문에 Gemini 호출 사이에 4.5초 쉰다 (--delay로 조절).
"""
import argparse
import contextlib
import csv
import datetime
import difflib
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from summary_core import (NO_RECORD, PROMPT_VERSION, AiAuthError, AiRateLimitError, AiUnavailableError,  # noqa: E402
                          SummaryService, max_chars)
from llm_clients import FakeClient, GeminiClient, load_dotenv  # noqa: E402
from server import make_server  # noqa: E402


def say(msg):
    sys.__stdout__.write(msg + "\n")
    sys.__stdout__.flush()


class CapturingClient:
    """Gemini로 실제 보낸 글을 기록한다 (이름이 가려졌는지 확인하려고)."""

    def __init__(self, inner):
        self.inner, self.sent = inner, []
        self.model = getattr(inner, "model", "unknown")

    def generate(self, system, user):
        self.sent.append(user)
        return self.inner.generate(system, user)


class ScriptedFake:
    """--fake 전용: 입력 글자만 보고 그럴듯한 답을 만든다. 도구가 도는지만 본다."""
    model = "fake"

    def generate(self, system, user):
        plan = "다음 회기에 수면 기록을 점검하기로 함." if "다음 회기" in user else NO_RECORD
        inter = "상담 목표를 정함." if ("목표" in user or "확인하였다" in user) else NO_RECORD
        return json.dumps({"complaint": "잠을 잘 못 잔다고 함.", "intervention": inter, "nextPlan": plan}, ensure_ascii=False)


def http(port, method, path, body=None, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8"))
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=data, method=method,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    start = time.time()
    # 내 컴퓨터(127.0.0.1)로 가는 호출은 프록시 환경 변수를 무시한다 (--extra가 일부러 넣는 가짜 프록시에 막히지 않게)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=120) as r:
            status, text = r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8")
    try:
        payload = json.loads(text)
    except ValueError:
        payload = {"_raw": text}
    return status, payload, round(time.time() - start, 2)


def start_server(service):
    server = make_server(lambda: service, "127.0.0.1", 0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1]


RECORD_A = "내담자는 최근 직장 일로 잠을 못 잔다고 하였다. 업무 중 실수가 늘었다고 하였다. 상담 목표를 수면 시간 늘리기로 함께 정하였다. 다음 회기까지 수면 기록을 적어 오기로 하였다."
RECORD_NOPLAN = "내담자는 최근 직장 일로 잠을 못 잔다고 하였다. 업무 중 실수가 늘었다고 하였다. 상담자는 현재 상황을 확인하였다."
RECORD_NOINT = "내담자가 이번 주에 잠을 하루 5시간밖에 못 잤다고 보고함."
RECORD_LONG = " ".join("%d주차에 내담자는 직장에서 회의 전날 잠을 설치는 일이 %d번 있었다고 보고하였다." % (i, i % 4 + 1) for i in range(1, 121)) \
    + " 상담 목표를 수면 시간 늘리기로 함께 정하였다. 다음 회기에는 수면 기록을 함께 점검하기로 하였다."
RECORD_NAME = "김하늘 내담자는 최근 잠을 못 잔다고 하였다. 김하늘은 직장 일이 힘들다고 하였다. 다음 회기는 1주 후."
FIELDS = ("complaint", "intervention", "nextPlan")


def run_extra(args, fake):
    """네트워크 오류와 호출 한도(429)를 실제 라이브러리 경로로 확인한다."""
    rows = []

    def add(item, expected, actual, ok, note=""):
        verdict = "통과" if ok is True else ("실패" if ok is False else str(ok))
        rows.append((item, expected, actual, verdict, note))
        say("[%s] %s %s" % (verdict, item, note))

    # 1) 네트워크 오류: 존재하지 않는 프록시로 연결을 막아 실제 라이브러리의 연결 실패를 만든다
    proxy_keys = ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy")
    saved = {k: os.environ.get(k) for k in proxy_keys}
    try:
        if fake:
            client = FakeClient(AiUnavailableError("fake"))
        else:
            for k in proxy_keys:
                os.environ[k] = "http://127.0.0.1:9"
            client = GeminiClient()
        server, port = start_server(SummaryService(client, max_retries=0, sleep=lambda s: None))
        with contextlib.redirect_stdout(io.StringIO()):
            st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": "내담자는 최근 잠을 잘 못 잔다고 하였다."})
        server.shutdown()
        server.server_close()
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    add("네트워크 오류(연결 차단)", "502 AI_UNAVAILABLE, manualInput true", "%s %s %s (%.1f초)" % (st, p.get("error"), p.get("manualInput"), sec),
        st == 502 and p.get("error") == "AI_UNAVAILABLE" and p.get("manualInput") is True, "프록시를 막아 실제 연결 실패를 만듦" if not fake else "가짜 응답")

    # 2) 호출 한도: 짧은 요청을 연달아 보내 429를 만나고, 기다린 뒤 회복되는지 본다
    if fake:
        client = FakeClient("{\"complaint\":\"a\",\"intervention\":\"b\",\"nextPlan\":\"c\"}", AiRateLimitError("q", retry_after=1),
                            "{\"complaint\":\"a\",\"intervention\":\"b\",\"nextPlan\":\"c\"}")
    else:
        client = GeminiClient()
    server, port = start_server(SummaryService(client, max_retries=0, sleep=lambda s: None))
    hit = None
    with contextlib.redirect_stdout(io.StringIO()):
        for i in range(1, 31):
            st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": "내담자는 최근 잠을 잘 못 잔다고 하였다."})
            if st == 429:
                hit = (i, p)
                break
            if st != 200:
                hit = (i, p)
                break
    if hit and hit[1].get("error") == "AI_RATE_LIMITED":
        wait = int(hit[1].get("retryAfterSeconds") or 60)
        add("호출 한도(429)", "429 AI_RATE_LIMITED, manualInput true", "%d번째 호출에서 429, 대기 %d초" % (hit[0], wait),
            st == 429 and hit[1].get("manualInput") is True, "retryAfterSeconds=%s" % hit[1].get("retryAfterSeconds"))
        time.sleep(0 if fake else wait + 3)
        with contextlib.redirect_stdout(io.StringIO()):
            st2, p2, _ = http(port, "POST", "/api/ai/summary", {"recordText": "내담자는 최근 잠을 잘 못 잔다고 하였다."})
        add("한도 뒤 회복", "기다린 뒤 200", "%s" % st2, st2 == 200, "대기 후 다시 호출")
    elif hit:
        add("호출 한도(429)", "429 AI_RATE_LIMITED", "%d번째에서 %s %s" % (hit[0], st, hit[1].get("error")), False, "한도가 아닌 다른 오류")
    else:
        add("호출 한도(429)", "30번 안에 429", "30번 모두 성공", "한도에 닿지 않음", "무료 한도가 더 크거나 요금제가 다름")
    server.shutdown()
    server.server_close()

    os.makedirs(args.out, exist_ok=True)
    lines = ["# AI 요약 서버 추가 검증 (네트워크 오류, 호출 한도)", "",
             "- 실행: %s, 프롬프트: %s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), PROMPT_VERSION)]
    if fake:
        lines.append("- **가짜 응답으로 도구만 점검한 결과이며 실제 검증이 아니다.**")
    lines += ["", "| 항목 | 기대 | 실제 | 판정 | 메모 |", "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append("| %s | %s | %s | %s | %s |" % tuple(str(x).replace("|", "/") for x in r))
    with open(os.path.join(args.out, "live_check_extra_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    say("\n결과: %s" % args.out)
    sys.exit(1 if any(r[3] == "실패" for r in rows) else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fake", action="store_true")
    ap.add_argument("--delay", type=float, default=4.5)
    ap.add_argument("--repeat", type=int, default=5)
    ap.add_argument("--extra", action="store_true")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(HERE), "eval_output"))
    args = ap.parse_args()
    fake = args.fake
    if not fake:
        load_dotenv()
        if not os.environ.get("GEMINI_API_KEY"):
            sys.exit("GEMINI_API_KEY가 없습니다. 환경 변수나 이 폴더의 .env에 넣으세요.")
    if args.extra:
        return run_extra(args, fake)
    LIVE = "가짜 응답(도구 점검)" if fake else "실제 Gemini 호출"
    SERVER = "서버만(Gemini 호출 없음)"
    MOCK = "가짜 클라이언트(단위 시험)"
    cap = CapturingClient(ScriptedFake() if fake else GeminiClient())
    service = SummaryService(cap, sleep=(lambda s: None) if fake else time.sleep)
    server, port = start_server(service)
    rows, logbuf, outputs = [], io.StringIO(), []
    key_value = os.environ.get("GEMINI_API_KEY", "")

    def add(item, expected, actual, ok, method, sec="", note=""):
        verdict = "통과" if ok is True else ("실패" if ok is False else str(ok))
        rows.append(dict(item=item, expected=expected, actual=actual, verdict=verdict, method=method, sec=sec, note=note))
        say("[%s] %s (%s) %s" % (verdict, item, method, note))

    def keep(label, record, p):
        outputs.append((label, record, {k: p.get(k, p.get("error", "")) for k in FIELDS}))

    def pace():
        if not fake:
            time.sleep(args.delay)

    def ok_fields(p):
        return all(isinstance(p.get(k), str) and p[k].strip() for k in FIELDS)

    def brief(p):
        return "; ".join("%s=%s" % (k, str(p.get(k, ""))[:28]) for k in FIELDS)

    with contextlib.redirect_stdout(logbuf):  # 서버가 찍는 로그를 모아서 나중에 점검한다
        st, p, sec = http(port, "GET", "/health")
        add("서버 상태(/health)", "200, OK", "%s %s" % (st, p.get("status")), st == 200 and p.get("status") == "OK", SERVER, sec)

        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_A})
        ok = (st == 200 and ok_fields(p) and p.get("status") == "DRAFT" and p.get("reviewRequired") is True
              and p.get("aiGenerated") is True and bool(p.get("model")) and p.get("promptVersion") == PROMPT_VERSION)
        add("정상 기록: 세 항목, 초안 표시, 모델명, 프롬프트 버전", "200, 세 항목 문자열, DRAFT, 모델명, " + PROMPT_VERSION, "%s; %s" % (st, brief(p)), ok, LIVE, sec,
            "model=%s, 버전=%s" % (p.get("model"), p.get("promptVersion")))
        keep("정상 기록", RECORD_A, p)

        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_NOPLAN})
        add("다음 계획이 없는 기록", "nextPlan이 '기록에 없음'", "%s; nextPlan=%s" % (st, p.get("nextPlan")), st == 200 and p.get("nextPlan") == NO_RECORD, LIVE, sec)
        keep("다음 계획이 없는 기록", RECORD_NOPLAN, p)

        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_NOINT})
        add("상담자 행동이 없는 기록(내담자 보고만)", "intervention, nextPlan이 '기록에 없음'", "%s; %s" % (st, brief(p)),
            st == 200 and p.get("intervention") == NO_RECORD and p.get("nextPlan") == NO_RECORD, LIVE, sec)
        keep("상담자 행동이 없는 기록", RECORD_NOINT, p)

        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_LONG})
        add("긴 기록(%d자)" % len(RECORD_LONG), "200, 세 항목, nextPlan에 '수면 기록'", "%s; %s" % (st, brief(p)),
            st == 200 and ok_fields(p) and "수면 기록" in str(p.get("nextPlan")), LIVE, sec, "%d자" % len(RECORD_LONG))
        keep("긴 기록(%d자)" % len(RECORD_LONG), RECORD_LONG, p)

        before = len(cap.sent)
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": "가" * (max_chars() + 1)})
        add("너무 긴 기록(%d자 초과)" % max_chars(), "413 RECORD_TOO_LONG, Gemini 호출 없음", "%s %s" % (st, p.get("error")),
            st == 413 and p.get("error") == "RECORD_TOO_LONG" and len(cap.sent) == before, SERVER, sec)

        before = len(cap.sent)
        cases = [("빈 문자열", dict(body={"recordText": ""}), 400, "EMPTY_RECORD"),
                 ("공백만", dict(body={"recordText": "  \n "}), 400, "EMPTY_RECORD"),
                 ("recordText가 null", dict(body={"recordText": None}), 400, "EMPTY_RECORD"),
                 ("recordText 없음", dict(body={"text": "x"}), 400, "INVALID_REQUEST"),
                 ("JSON이 아닌 본문", dict(raw=b"not json"), 400, "INVALID_REQUEST"),
                 ("본문 없음", dict(raw=b""), 400, "INVALID_REQUEST"),
                 ("maskTerms 형식 오류", dict(body={"recordText": "기록", "maskTerms": "김하늘"}), 400, "INVALID_REQUEST"),
                 ("없는 주소", dict(path="/nope", body={"recordText": "기록"}), 404, "NOT_FOUND")]
        for label, kw, want_status, want_error in cases:
            st, p, sec = http(port, "POST", kw.get("path", "/api/ai/summary"), kw.get("body"), kw.get("raw"))
            add("잘못된 요청: " + label, "%d %s" % (want_status, want_error), "%s %s" % (st, p.get("error")), st == want_status and p.get("error") == want_error, SERVER, sec)
        add("잘못된 요청에서 Gemini를 부르지 않음", "호출 0회", "%d회" % (len(cap.sent) - before), len(cap.sent) == before, SERVER)

        results = []
        for i in range(args.repeat):
            pace()
            st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_A})
            results.append((st, p, sec))
            keep("같은 기록 반복 %d번째" % (i + 1), RECORD_A, p)
        texts = [" | ".join(str(r[1].get(k, "")) for k in FIELDS) for r in results]
        exact = sum(1 for t in texts if t == texts[0])
        min_sim = min(difflib.SequenceMatcher(None, texts[0], t).ratio() for t in texts)
        all_ok = all(r[0] == 200 and ok_fields(r[1]) for r in results)
        add("같은 기록 %d번 반복: JSON 형식 유지" % args.repeat, "모두 200, 세 항목", "%d/%d" % (sum(1 for r in results if r[0] == 200 and ok_fields(r[1])), args.repeat), all_ok, LIVE,
            round(sum(r[2] for r in results) / len(results), 2), "평균 시간")
        add("같은 기록 %d번 반복: 결과 일관성" % args.repeat, "유사도 0.8 이상(참고 기준)", "완전 일치 %d/%d, 최소 유사도 %.2f" % (exact, args.repeat, min_sim),
            True if min_sim >= 0.8 else "확인 필요", LIVE, "", "서로 다른 문장이 나오면 원문을 읽어 확인")

        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_NAME, "maskTerms": ["김하늘"]})
        sent = cap.sent[-1]
        keep("이름 가리기(maskTerms 사용)", RECORD_NAME, p)
        add("이름 가리기(maskTerms 사용)", "AI에 보낸 글과 결과에 이름 없음", "보낸 글에 이름 %s, 결과에 이름 %s" % ("있음" if "김하늘" in sent else "없음", "있음" if "김하늘" in json.dumps(p, ensure_ascii=False) else "없음"),
            st == 200 and "김하늘" not in sent and "김하늘" not in json.dumps(p, ensure_ascii=False), LIVE, sec)
        pace()
        st, p, sec = http(port, "POST", "/api/ai/summary", {"recordText": RECORD_NAME})
        add("이름 가리기(maskTerms 없이): 한계 확인", "이름이 그대로 AI로 감", "보낸 글에 이름 %s" % ("있음" if "김하늘" in cap.sent[-1] else "없음"),
            "확인됨(한계)" if "김하늘" in cap.sent[-1] else "예상과 다름", LIVE, sec, "이름은 백엔드가 maskTerms로 알려 줘야 가려진다")
        keep("이름 가리기(maskTerms 없이)", RECORD_NAME, p)

        pace()
        bad = SummaryService(FakeClient(AiAuthError("403")) if fake else GeminiClient(api_key="invalid-test-key"), sleep=lambda s: None)
        server2, port2 = start_server(bad)
        st, p, sec = http(port2, "POST", "/api/ai/summary", {"recordText": "기록"})
        add("API 키 오류", "502 AI_AUTH_FAILED, manualInput true", "%s %s %s" % (st, p.get("error"), p.get("manualInput")),
            st == 502 and p.get("error") == "AI_AUTH_FAILED" and p.get("manualInput") is True, "가짜 키로 실제 호출" if not fake else LIVE, sec)
        server2.shutdown()
        server2.server_close()
    server.shutdown()
    server.server_close()

    log = logbuf.getvalue()
    leaked = [w for w in ("김하늘", "직장 일", "수면 기록", "잠을", "내담자") if w in log]
    if key_value and key_value in log:
        leaked.append("API 키")
    add("서버 로그에 기록 내용과 키가 없음", "요청 줄만 있음", "로그 %d줄, 노출 %s" % (len(log.splitlines()), leaked or "없음"), not leaked, SERVER)
    add("호출 한도(429) 대응", "AI_RATE_LIMITED, 기다렸다 재시도", "실제 호출로 재현하지 않음", "실제 호출 안 함", MOCK, "", "단위 시험에서 확인")
    add("네트워크 오류 대응", "AI_UNAVAILABLE, 1회 재시도 후 수동 입력", "실제 호출로 재현하지 않음", "실제 호출 안 함", MOCK, "", "단위 시험에서 확인")

    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "live_check_results.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["항목", "기대", "실제", "판정", "방식", "시간(초)", "메모"])
        for r in rows:
            w.writerow([r["item"], r["expected"], r["actual"], r["verdict"], r["method"], r["sec"], r["note"]])
    n_pass = sum(r["verdict"] == "통과" for r in rows)
    n_fail = sum(r["verdict"] == "실패" for r in rows)
    lines = ["# AI 요약 서버 검증 보고서", "",
             "- 실행: %s, 모델: %s, 프롬프트: %s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), cap.model, PROMPT_VERSION)]
    if fake:
        lines.append("- **가짜 응답으로 도구만 점검한 결과이며 Gemini 검증이 아니다.**")
    lines += ["- 통과 %d, 실패 %d, 그 밖(확인 필요, 한계, 실제 호출 안 함) %d" % (n_pass, n_fail, len(rows) - n_pass - n_fail), "",
              "| 항목 | 기대 | 실제 | 판정 | 방식 | 시간(초) | 메모 |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append("| %s | %s | %s | %s | %s | %s | %s |" % tuple(str(r[k]).replace("|", "/") for k in ("item", "expected", "actual", "verdict", "method", "sec", "note")))
    with open(os.path.join(args.out, "live_check_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    out_lines = ["# AI 요약 전체 응답 (원문 대조용)", "",
                 "요약이 원문에 충실한지는 사람이 직접 읽어서 확인한다. 가상 기록이다.", ""]
    for label, record, fields in outputs:
        shown = record if len(record) <= 200 else record[:200] + " ... (총 %d자)" % len(record)
        out_lines += ["## " + label, "", "- 입력: " + shown.replace("\n", " / ")]
        out_lines += ["- %s: %s" % (k, fields[k]) for k in FIELDS] + [""]
    with open(os.path.join(args.out, "live_check_outputs.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")
    say("\n통과 %d / 실패 %d / 그 밖 %d  (결과: %s)" % (n_pass, n_fail, len(rows) - n_pass - n_fail, args.out))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
