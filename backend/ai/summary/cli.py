"""명령줄에서 요약 한 건을 시험한다.
  py cli.py --file 기록.txt
  py cli.py --text "내담자는 ..."
키는 환경 변수 GEMINI_API_KEY로만 넣는다.
"""
import argparse
import json
import sys

from summary_core import SummaryError, SummaryService
from llm_clients import GeminiClient


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--file")
    p.add_argument("--text")
    a = p.parse_args()
    if a.file:
        with open(a.file, encoding="utf-8") as f:
            record = f.read()
    else:
        record = a.text if a.text is not None else sys.stdin.read()
    try:
        result = SummaryService(GeminiClient()).summarize(record)
    except SummaryError as e:
        print(json.dumps(e.to_dict(), ensure_ascii=False, indent=2))
        sys.exit(1)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
