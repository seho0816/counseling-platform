"""AI 요약 응답(JSON) 검증과 실패 처리 시험 (API 키 없이 실행)

백엔드는 parse_summary와 summarize_with_retry를 가져다 쓴다.
  1) 응답이 JSON으로 읽히는가 (코드 블록 표시 ``` 는 제거)
  2) 필수 필드가 모두 있고 비어 있지 않은 문자열인가
  3) 실패하면 1회 재시도, 그래도 실패하면 수동 입력 안내 (NFR-06)
실행: python 11_json_validate.py  -> 시험 결과를 json_validate_result.csv에 저장
"""
import csv
import json

FIELDS = ["chief_complaint", "intervention", "next_plan"]


def parse_summary(text, fields=FIELDS):
    """(성공 여부, 데이터 또는 None, 실패 이유)"""
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("{"):]
    try:
        data = json.loads(t)
    except (json.JSONDecodeError, ValueError):
        return False, None, "JSON으로 읽을 수 없음"
    if not isinstance(data, dict):
        return False, None, "JSON 객체가 아님"
    for f in fields:
        v = data.get(f)
        if not isinstance(v, str) or not v.strip():
            return False, None, f"필드 누락 또는 빈 값: {f}"
    return True, data, ""


def summarize_with_retry(call, record, retries=1, fields=FIELDS):
    """call(record)가 문자열을 돌려준다. 실패하면 retries번 다시 시도한다."""
    last = ""
    for _ in range(retries + 1):
        try:
            ok, data, reason = parse_summary(call(record), fields)
        except Exception as e:  # 네트워크, 한도 등 호출 자체의 실패
            ok, data, reason = False, None, f"호출 실패: {e}"
        if ok:
            return {"ok": True, "data": data, "manual_input": False}
        last = reason
    return {"ok": False, "error": last, "manual_input": True}


GOOD = '{"chief_complaint":"a","intervention":"b","next_plan":"c"}'


def seq(*answers):
    it = iter(answers)

    def call(_):
        a = next(it)
        if isinstance(a, Exception):
            raise a
        return a
    return call


CASES = [
    ("정상 JSON", seq(GOOD), True, False),
    ("코드 블록이 붙은 정상 JSON", seq("```json\n" + GOOD + "\n```"), True, False),
    ("필드 하나 누락 → 재시도도 같은 실패 → 수동 입력", seq('{"chief_complaint":"a","intervention":"b"}', '{"chief_complaint":"a","intervention":"b"}'), False, True),
    ("빈 값 → 재시도 성공", seq('{"chief_complaint":"a","intervention":"","next_plan":"c"}', GOOD), True, False),
    ("JSON이 아닌 문장 → 재시도 성공", seq("죄송합니다. 요약할 수 없습니다.", GOOD), True, False),
    ("두 번 모두 JSON 아님 → 수동 입력", seq("오류", "오류"), False, True),
    ("호출 예외 → 재시도 성공", seq(RuntimeError("503"), GOOD), True, False),
    ("호출 예외 두 번 → 수동 입력", seq(RuntimeError("429"), RuntimeError("429")), False, True),
]


def run_tests(path="json_validate_result.csv"):
    rows, passed = [], 0
    for name, call, exp_ok, exp_manual in CASES:
        r = summarize_with_retry(call, "기록")
        ok = (r["ok"] == exp_ok) and (r["manual_input"] == exp_manual)
        passed += ok
        rows.append({"시험": name, "기대: 성공": "예" if exp_ok else "아니오", "기대: 수동 입력 안내": "예" if exp_manual else "아니오",
                     "결과: 성공": "예" if r["ok"] else "아니오", "결과: 수동 입력 안내": "예" if r["manual_input"] else "아니오",
                     "통과": "통과" if ok else "실패"})
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"[{r['통과']}] {r['시험']}")
    print(f"\n{passed}/{len(CASES)} 통과, 결과는 {path}에 저장했습니다.")
    return passed == len(CASES)


if __name__ == "__main__":
    run_tests()
