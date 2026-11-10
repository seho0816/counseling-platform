"""요약 기능 평가: 가상 상담 기록 26개 + API 오류 처리 6개를 돌려 결과표를 만든다.

사용법 (backend/ai/summary 폴더에서)
  export GEMINI_API_KEY=키        # 키는 환경 변수로만 넣는다
  py tests/run_eval.py            # 실제 LLM 호출, eval_output/에 결과 저장
  py tests/run_eval.py --fake     # 키 없이 시험 도구만 점검 (LLM 결과가 아니다)
  py tests/run_eval.py --tag v6   # 결과 파일 이름에 _v6을 붙인다 (프롬프트를 바꿔 비교할 때)
무료 한도(분당 15회) 때문에 호출 사이에 4.5초 쉰다 (--delay로 조절).
"""
import argparse
import csv
import datetime
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from summary_core import (PROMPT_VERSION, NO_RECORD, AiAuthError, AiRateLimitError, AiUnavailableError,
                          SummaryError, SummaryService, FIELDS)  # noqa: E402
from llm_clients import FakeClient  # noqa: E402


class CountingClient:
    def __init__(self, inner):
        self.inner, self.count = inner, 0
        self.model = getattr(inner, "model", "unknown")

    def generate(self, system, user):
        self.count += 1
        return self.inner.generate(system, user)


def evaluate_case(case, result, llm_called):
    """result: 성공이면 요약 dict, 실패면 {'error': 코드}. 반환: (판정, 문제 목록)"""
    exp, problems, warns = case["expect"], [], []
    if "error" in exp:
        if result.get("error") != exp["error"]:
            problems.append("기대한 오류 %s가 아니라 %s" % (exp["error"], result.get("error", "정상 응답")))
        if exp.get("llm_called") is False and llm_called:
            problems.append("빈 기록인데 AI를 호출함")
        return ("FAIL" if problems else "PASS"), problems
    if "error" in result:
        return "FAIL", ["오류가 남: %s" % result["error"]]
    for f in FIELDS:
        if not isinstance(result.get(f), str) or not result[f].strip():
            problems.append("필드가 비어 있음: " + f)
    for f in exp.get("none_fields", []):
        if result.get(f, "").strip() != NO_RECORD:
            problems.append("%s는 '기록에 없음'이어야 하는데 '%s'" % (f, result.get(f, "")[:40]))
    for f, groups in exp.get("include", {}).items():
        for g in groups:
            if not any(a in result.get(f, "") for a in g):
                problems.append("%s에 %s가 없음" % (f, "/".join(g)))
    for group in exp.get("keep", []):
        if not any(a in " ".join(result.get(f, "") for f in FIELDS) for a in group):
            problems.append("원문의 중요한 정보가 빠짐: " + "/".join(group))
    for f, words in exp.get("forbid_fields", {}).items():
        for w in words:
            if w in result.get(f, ""):
                problems.append("%s에 들어가면 안 되는 말: %s" % (f, w))
    joined = " ".join(result.get(f, "") for f in FIELDS)
    for w in exp.get("forbid", []):
        if w in joined:
            problems.append("기록에 없는 말이 나옴: " + w)
    if exp.get("max_len"):
        too_long = [f for f in FIELDS if len(result.get(f, "")) > exp["max_len"]]
        if too_long:
            warns.append("항목이 %d자를 넘음: %s" % (exp["max_len"], ",".join("%s(%d자)" % (f, len(result[f])) for f in too_long)))
    extra = sorted(set(re.findall(r"\d+", joined)) - set(re.findall(r"\d+", case["record"])), key=int)
    if extra:
        warns.append("기록에 없는 숫자 확인 필요: " + ",".join(extra))
    if problems:
        return "FAIL", problems + warns
    return ("WARN" if warns else "PASS"), warns


def fake_answer(case):
    """--fake 전용: 기대 조건을 만족하는 답을 만들어 시험 도구가 돌아가는지만 본다."""
    exp, out = case["expect"], {}
    for f in FIELDS:
        if f in exp.get("none_fields", []):
            out[f] = NO_RECORD
        else:
            words = [g[0] for g in exp.get("include", {}).get(f, [])]
            if f == "complaint":
                words += [g[0] for g in exp.get("keep", [])]
            out[f] = " ".join(words) if words else "내용"
    return json.dumps(out, ensure_ascii=False)


SCENARIOS = [
    ("API 한도 초과(429) 후 재시도하면 성공", [AiRateLimitError("quota", retry_after=1), '{"complaint":"a","intervention":"b","nextPlan":"c"}'], "OK"),
    ("API 한도 초과(429)가 계속됨", [AiRateLimitError("quota", retry_after=1)], "AI_RATE_LIMITED"),
    ("API 키·권한 오류(403)", [AiAuthError("403")], "AI_AUTH_FAILED"),
    ("서버 오류(503)가 계속됨", [AiUnavailableError("503")], "AI_UNAVAILABLE"),
    ("AI가 JSON이 아닌 문장만 돌려줌", ["죄송합니다. 요약할 수 없습니다."], "AI_INVALID_RESPONSE"),
    ("AI가 필드 하나를 빠뜨렸다가 다시 시도하면 정상", ['{"complaint":"a","intervention":"b"}', '{"complaint":"a","intervention":"b","nextPlan":"c"}'], "OK"),
]


def run_scenarios():
    rows = []
    for name, steps, expected in SCENARIOS:
        client = FakeClient(*steps)
        try:
            SummaryService(client, prompt_text="p", sleep=lambda s: None).summarize("기록")
            actual, manual = "OK", False
        except SummaryError as e:
            actual, manual = e.code, e.manual_input
        rows.append(dict(name=name, expected=expected, actual=actual, manual=manual,
                         calls=len(client.calls), ok=(actual == expected)))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fake", action="store_true")
    ap.add_argument("--delay", type=float, default=4.5)
    ap.add_argument("--tag", default="")  # 결과 파일 이름에 붙일 말 (예: v6)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(HERE), "eval_output"))
    args = ap.parse_args()
    cases = json.load(open(os.path.join(HERE, "eval_cases.json"), encoding="utf-8"))["cases"]
    if not args.fake:
        from llm_clients import GeminiClient
        real = GeminiClient()
    rows = []
    for c in cases:
        client = CountingClient(FakeClient(fake_answer(c)) if args.fake else real)
        service = SummaryService(client, sleep=time.sleep if not args.fake else (lambda s: None))
        start = time.time()
        try:
            result = service.summarize(c["record"])
        except SummaryError as e:
            result = e.to_dict()
        sec = round(time.time() - start, 2)
        verdict, notes = evaluate_case(c, result, client.count > 0)
        rows.append(dict(c=c, result=result, verdict=verdict, notes=notes, sec=sec))
        print(c["id"], verdict, "%.2f초" % sec, "; ".join(notes))
        if not args.fake and client.count > 0:
            time.sleep(args.delay)
    scen = run_scenarios()
    os.makedirs(args.out, exist_ok=True)
    tag = ("FAKE" if args.fake else "LLM") + (("_" + args.tag) if args.tag else "")
    model = "fake" if args.fake else real.model
    with open(os.path.join(args.out, "eval_results_%s.csv" % tag), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "유형", "입력 글자수", "판정", "걸린 시간(초)", "기대 결과", "발견한 문제", "complaint", "intervention", "nextPlan", "오류 코드"])
        for r in rows:
            res = r["result"]
            w.writerow([r["c"]["id"], r["c"]["type"], len(r["c"]["record"]), r["verdict"], r["sec"], r["c"]["expected_text"],
                        " / ".join(r["notes"]), res.get("complaint", ""), res.get("intervention", ""), res.get("nextPlan", ""), res.get("error", "")])
    n = {k: sum(1 for r in rows if r["verdict"] == k) for k in ("PASS", "WARN", "FAIL")}
    lines = ["# 상담 기록 AI 요약 평가 결과 (%s)" % tag, "",
             "- 실행: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
             "- 모델: %s, 프롬프트: %s" % (model, PROMPT_VERSION)]
    if args.fake:
        lines.append("- **이 결과는 LLM이 아니라 가짜 응답으로 시험 도구만 점검한 것이다. 실제 요약 품질의 근거가 아니다.**")
    lines += ["- %d개 중 통과 %d, 경고 %d, 실패 %d" % (len(rows), n["PASS"], n["WARN"], n["FAIL"]), "",
              "## 입력별 결과", "", "| id | 유형 | 판정 | 기대 결과 | 발견한 문제 |", "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append("| %s | %s | %s | %s | %s |" % (r["c"]["id"], r["c"]["type"], r["verdict"], r["c"]["expected_text"], "; ".join(r["notes"]) or "없음"))
    lines += ["", "## 요약 원문 (상담사 검토 참고)", ""]
    for r in rows:
        res = r["result"]
        lines += ["**%s %s**" % (r["c"]["id"], r["c"]["type"]), "",
                  "- 입력: %s" % r["c"]["record"].replace("\n", " / ")[:200]]
        if "error" in res:
            lines.append("- 오류: %s (manualInput=%s)" % (res["error"], res.get("manualInput")))
        else:
            lines += ["- complaint: " + res["complaint"], "- intervention: " + res["intervention"], "- nextPlan: " + res["nextPlan"]]
        lines.append("")
    lines += ["## API 오류 처리 시험 (가짜 클라이언트)", "", "| 상황 | 기대 | 실제 | 수동 입력 안내 | 호출 횟수 | 판정 |", "| --- | --- | --- | --- | --- | --- |"]
    for s in scen:
        lines.append("| %s | %s | %s | %s | %d | %s |" % (s["name"], s["expected"], s["actual"], "예" if s["manual"] else "아니오", s["calls"], "통과" if s["ok"] else "실패"))
    with open(os.path.join(args.out, "eval_report_%s.md" % tag), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n통과 %d / 경고 %d / 실패 %d, 오류 처리 시험 %d/%d 통과" % (n["PASS"], n["WARN"], n["FAIL"], sum(s["ok"] for s in scen), len(scen)))
    print("결과:", args.out)


if __name__ == "__main__":
    main()
