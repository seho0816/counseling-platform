"""프롬프트 여러 개를 같은 입력으로 번갈아 여러 번 돌려 비교한다 (실제 Gemini, 키 필요).

한 번씩만 돌리면 같은 프롬프트도 결과가 달라지고, 시간대에 따라 응답 시간도 달라서 비교가 어렵다.
그래서 입력마다 프롬프트를 번갈아 부르고 이를 여러 번 반복한다.

사용법 (backend/ai/summary 폴더에서)
  python tests/compare_prompts.py                      # v5 v6 v7을 대표 12개 입력으로 3번씩 (약 10~15분)
  python tests/compare_prompts.py --prompts v5 v7 --repeat 2
  python tests/compare_prompts.py --cases all          # 모든 입력 (오래 걸린다)
  python tests/compare_prompts.py --fake               # 키 없이 도구만 점검 (실제 비교가 아니다)
결과: eval_output/compare_report.md, compare_results.csv
"""
import argparse
import csv
import json
import os
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

from summary_core import FIELDS, SummaryError, SummaryService  # noqa: E402
from llm_clients import FakeClient, GeminiClient, load_dotenv  # noqa: E402
import run_eval  # noqa: E402

DEFAULT_CASES = ["C01", "C03", "C06", "C09", "C11", "C12", "C19", "C20", "C21", "C22", "C25", "C26"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompts", nargs="+", default=["v5", "v6", "v7"])
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--cases", default=",".join(DEFAULT_CASES))
    ap.add_argument("--delay", type=float, default=4.5)
    ap.add_argument("--fake", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "eval_output"))
    args = ap.parse_args()
    all_cases = json.load(open(os.path.join(HERE, "eval_cases.json"), encoding="utf-8"))["cases"]
    llm_cases = [c for c in all_cases if "error" not in c["expect"]]
    wanted = [c["id"] for c in llm_cases] if args.cases == "all" else [x.strip() for x in args.cases.split(",")]
    cases = [c for c in llm_cases if c["id"] in wanted]
    texts = {}
    for v in args.prompts:
        path = os.path.join(ROOT, "prompts", "summary_prompt_%s.txt" % v)
        texts[v] = open(path, encoding="utf-8").read()
    if not args.fake:
        load_dotenv()
        if not os.environ.get("GEMINI_API_KEY"):
            sys.exit("GEMINI_API_KEY가 없습니다.")
    real = None if args.fake else GeminiClient()
    rows = []
    total = len(cases) * len(args.prompts) * args.repeat
    n = 0
    for rep in range(1, args.repeat + 1):
        for case in cases:
            for v in args.prompts:  # 같은 입력에서 프롬프트를 번갈아 부른다
                client = FakeClient(run_eval.fake_answer(case)) if args.fake else real
                svc = SummaryService(client, prompt_text=texts[v], sleep=(lambda s: None) if args.fake else time.sleep)
                start = time.time()
                try:
                    result = svc.summarize(case["record"])
                except SummaryError as e:
                    result = e.to_dict()
                sec = round(time.time() - start, 2)
                verdict, notes = run_eval.evaluate_case(case, result, True)
                rows.append(dict(rep=rep, id=case["id"], prompt=v, verdict=verdict, sec=sec, notes="; ".join(notes),
                                 complaint=result.get("complaint", ""), intervention=result.get("intervention", ""), nextPlan=result.get("nextPlan", "")))
                n += 1
                sys.__stdout__.write("[%d/%d] 반복%d %s %s %s %.1f초 %s\n" % (n, total, rep, case["id"], v, verdict, sec, "; ".join(notes)))
                sys.__stdout__.flush()
                if not args.fake:
                    time.sleep(args.delay)
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "compare_results.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["반복", "id", "프롬프트", "판정", "시간(초)", "발견한 문제", "complaint", "intervention", "nextPlan"])
        for r in rows:
            w.writerow([r["rep"], r["id"], r["prompt"], r["verdict"], r["sec"], r["notes"], r["complaint"], r["intervention"], r["nextPlan"]])
    lines = ["# 프롬프트 비교 (같은 입력, 번갈아 %d번씩)" % args.repeat, ""]
    if args.fake:
        lines += ["**가짜 응답으로 도구만 점검한 결과이며 실제 비교가 아니다.**", ""]
    lines += ["| 프롬프트 | 통과 | 경고 | 실패 | 시간 중앙값(초) | 5초 넘은 호출 |", "| --- | --- | --- | --- | --- | --- |"]
    for v in args.prompts:
        rs = [r for r in rows if r["prompt"] == v]
        c = {k: sum(1 for r in rs if r["verdict"] == k) for k in ("PASS", "WARN", "FAIL")}
        ts = [r["sec"] for r in rs]
        lines.append("| %s | %d/%d | %d | %d | %.1f | %d |" % (v, c["PASS"], len(rs), c["WARN"], c["FAIL"], statistics.median(ts), sum(1 for t in ts if t > 5)))
    lines += ["", "## 입력별 (통과한 횟수 / 반복 횟수)", "", "| 입력 | " + " | ".join(args.prompts) + " | 흔들린 점 |", "| --- | " + " | ".join("---" for _ in args.prompts) + " | --- |"]
    for case in cases:
        cells, issues = [], set()
        for v in args.prompts:
            rs = [r for r in rows if r["id"] == case["id"] and r["prompt"] == v]
            cells.append("%d/%d" % (sum(1 for r in rs if r["verdict"] == "PASS"), len(rs)))
            issues.update("%s: %s" % (v, r["notes"]) for r in rs if r["notes"])
        lines.append("| %s | %s | %s |" % (case["id"], " | ".join(cells), " / ".join(sorted(issues))[:300].replace("|", "/")))
    with open(os.path.join(args.out, "compare_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    sys.__stdout__.write("\n결과: %s\n" % args.out)


if __name__ == "__main__":
    main()
