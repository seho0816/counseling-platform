"""배포된 AI 서버(Render)를 밖에서 호출해 보안, 개인정보, 요약 형식, 오류 처리를 확인한다.

주소와 토큰은 명령에 쓰지 않는다. 환경변수 AI_URL, AI_TOKEN으로 주거나 실행할 때 물어본다(토큰은 화면에 안 보인다).
  python tests/deployed_check.py
Render 무료 서비스는 한동안 쓰지 않으면 잠들어 첫 요청이 느릴 수 있어(1분 안팎) 첫 호출은 길게 기다린다.
가상 기록만 보내며, 서버는 요약만 돌려주고 저장하지 않는다(저장은 백엔드가 한다).
결과: 화면에 통과/실패를 보이고 eval_output/deployed_check_report.md를 만든다. 토큰과 주소는 보고서에 쓰지 않는다.
"""
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.request

PHONE, EMAIL, RRN = "010-1234-5678", "tester@example.com", "900101-1234567"
NAME = "김하늘"
FIELDS = ("complaint", "intervention", "nextPlan")
NO_RECORD = "기록에 없음"


def call(base, method, path, token=None, body=None, raw=None, wait=120):
    data = raw if raw is not None else (None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8"))
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token is not None:
        headers["X-AI-Token"] = token
    req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=wait) as r:
            status, text = r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8")
    except (TimeoutError, urllib.error.URLError) as e:
        return 0, {"error": "NO_RESPONSE", "detail": str(e)[:60]}, round(time.time() - start, 1)
    try:
        payload = json.loads(text) if text else {}
    except ValueError:
        payload = {"_raw": text[:120]}
    return status, payload, round(time.time() - start, 1)


def main():
    base = (os.environ.get("AI_URL") or input("AI 서버 주소(예: https://...onrender.com): ").strip()).rstrip("/")
    token = os.environ.get("AI_TOKEN") or getpass.getpass("AI_SHARED_TOKEN(화면에 안 보여요): ")
    rows = []

    def check(name, expected, actual, ok, note=""):
        rows.append((name, expected, actual, "통과" if ok is True else ("실패" if ok is False else str(ok)), note))
        print("[%s] %s %s" % (rows[-1][3], name, note))

    st, p, sec = call(base, "GET", "/health", wait=150)
    check("서버 상태(/health), 토큰 없이", "200 OK", "%s %s (%.1f초)" % (st, p.get("status"), sec), st == 200 and p.get("status") == "OK", "첫 호출은 잠에서 깨느라 느릴 수 있음")
    if st != 200:
        sys.exit("서버가 응답하지 않아요. 주소와 Render 상태를 확인하세요.")

    rec = {"recordText": "내담자는 최근 직장 일로 잠을 못 잔다고 하였다. 상담 목표를 수면 시간 늘리기로 정하였다."}
    st, p, _ = call(base, "POST", "/api/ai/summary", None, rec)
    check("토큰 없이 요약 요청", "401 UNAUTHORIZED", "%s %s" % (st, p.get("error")), st == 401 and p.get("error") == "UNAUTHORIZED")
    st, p, _ = call(base, "POST", "/api/ai/summary", "wrong-token-for-test", rec)
    check("틀린 토큰으로 요약 요청", "401 UNAUTHORIZED", "%s %s" % (st, p.get("error")), st == 401 and p.get("error") == "UNAUTHORIZED")

    st, p, sec = call(base, "POST", "/api/ai/summary", token, rec)
    ok = st == 200 and all(isinstance(p.get(k), str) and p[k].strip() for k in FIELDS) and p.get("status") == "DRAFT" and p.get("reviewRequired") is True
    check("맞는 토큰으로 요약 요청: 세 항목, DRAFT, 검토 필요", "200, 세 항목, DRAFT, reviewRequired true", "%s %s (%.1f초)" % (st, {k: str(p.get(k, ""))[:24] for k in FIELDS}, sec), ok)
    check("기본 프롬프트가 v8인가", "promptVersion = v8", "promptVersion = %s, model = %s" % (p.get("promptVersion"), p.get("model")), p.get("promptVersion") == "v8")

    pii = {"recordText": "내담자 %s는 연락처 %s, 이메일 %s, 주민번호 %s라고 적어 두었다. 최근 잠을 못 잔다고 하였다. 다음 회기는 1주 후." % (NAME, PHONE, EMAIL, RRN), "maskTerms": [NAME]}
    st, p, _ = call(base, "POST", "/api/ai/summary", token, pii)
    shown = json.dumps(p, ensure_ascii=False)
    leaked = [w for w in (NAME, PHONE, EMAIL, RRN, "1234567", "5678") if w in shown]
    check("개인정보(이름은 maskTerms, 전화·이메일·주민번호는 자동)가 응답에 나오지 않음", "응답에 개인정보 없음", "응답에 노출: %s" % (leaked or "없음"), st == 200 and not leaked, "AI에 보낸 글은 이 도구로 볼 수 없음. 서버가 가린 뒤 보낸다는 것은 단위 시험으로 확인")

    st, p, _ = call(base, "POST", "/api/ai/summary", token, {"recordText": "   "})
    check("빈 기록 거절", "400 EMPTY_RECORD", "%s %s" % (st, p.get("error")), st == 400 and p.get("error") == "EMPTY_RECORD")
    st, p, _ = call(base, "POST", "/api/ai/summary", token, raw=b"not json")
    check("JSON이 아닌 본문 거절", "400 INVALID_REQUEST", "%s %s" % (st, p.get("error")), st == 400 and p.get("error") == "INVALID_REQUEST")
    st, p, _ = call(base, "POST", "/api/ai/summary", token, {"recordText": "가" * 20001})
    check("너무 긴 기록 거절", "413 RECORD_TOO_LONG", "%s %s" % (st, p.get("error")), st == 413 and p.get("error") == "RECORD_TOO_LONG")

    samples = [
        ("계획이 없는 기록", "내담자는 최근 직장 일로 잠을 못 잔다고 하였다. 업무 중 실수가 늘었다고 하였다. 상담자는 현재 상황을 확인하였다.", lambda p: p.get("nextPlan") == NO_RECORD),
        ("다른 기관의 조언 구분", "내담자는 작년에 다른 기관에서 6회 상담을 받았다고 하였다. 당시 상담자가 일기 쓰기를 권했다고 하였다. 이번 회기에서는 감정 기록표를 함께 만들었다. 다음 회기까지 하루 한 번 기록표를 작성하기로 함.", lambda p: "일기" not in str(p.get("intervention", "")) and "기록표" in str(p.get("intervention", ""))),
    ]
    for label, text, test in samples:
        st, p, sec = call(base, "POST", "/api/ai/summary", token, {"recordText": text})
        check("품질 샘플: " + label, "200이고 기대한 칸에 기대한 내용", "%s %s (%.1f초)" % (st, {k: str(p.get(k, ""))[:30] for k in FIELDS}, sec), st == 200 and test(p), "사람이 응답 전체를 한 번 읽어 확인")

    os.makedirs(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_output"), exist_ok=True)
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_output", "deployed_check_report.md")
    lines = ["# 배포된 AI 서버 확인 (주소와 토큰은 적지 않음)", "", "- 실행: %s" % time.strftime("%Y-%m-%d %H:%M"), "", "| 항목 | 기대 | 실제 | 판정 | 메모 |", "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append("| %s |" % " | ".join(str(x).replace("|", "/") for x in r))
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    n_fail = sum(1 for r in rows if r[3] == "실패")
    print("\n통과 %d / 실패 %d  (보고서: %s)" % (sum(1 for r in rows if r[3] == "통과"), n_fail, out))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
