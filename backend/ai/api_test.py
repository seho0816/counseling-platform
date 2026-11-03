"""LLM API 호출 테스트: 상담 기록 요약 + JSON 응답 확인 + 응답 시간 측정

사용법
  python api_test.py 회사이름 session.csv SE03 SE02 SE06
  회사이름: claude, openai, gemini 중 하나

  claude : pip install anthropic       키 환경 변수 ANTHROPIC_API_KEY
  openai : pip install openai          키 환경 변수 OPENAI_API_KEY   (MODEL 지정 필요)
  gemini : pip install google-genai    키 환경 변수 GEMINI_API_KEY   (MODEL 지정 필요)

  키 설정: (Windows) set ANTHROPIC_API_KEY=발급받은키
           (Mac/Linux) export ANTHROPIC_API_KEY=발급받은키
  모델 지정: (Windows) set MODEL=모델이름   (Mac/Linux) export MODEL=모델이름
  모델 이름은 각 회사 공식 문서에서 확인한다. 결과 파일: api_test_result_회사이름.csv
  프롬프트 파일 지정(선택): export PROMPT_FILE=7_요약_프롬프트_v2.txt
  결과 파일 이름 뒤에 붙일 표시(선택): export RESULT_TAG=_v2

주의: API 키는 코드나 저장소에 적지 말고 환경 변수로만 쓴다.
      가상 데이터(session.csv)만 사용한다.
"""
import csv
import json
import os
import sys
import time

MODEL = os.environ.get("MODEL", "")
REQUIRED = ["chief_complaint", "intervention", "next_plan"]

SYSTEM = """너는 상담 기록을 요약하는 보조 도구다.
아래 규칙을 반드시 지킨다.
1. 기록에 있는 내용만 쓴다. 기록에 없는 내용은 추가하지 않는다.
2. 기록에서 확인되지 않는 항목은 '기록에 없음'이라고 쓴다.
3. 결과는 JSON 객체 하나만 출력한다. 설명이나 코드 블록 표시는 붙이지 않는다.
4. JSON 필드는 chief_complaint(주요 호소), intervention(개입 내용), next_plan(다음 계획) 세 개이며 값은 각각 1~2문장 문자열이다."""


def make_caller(provider):
    """회사별 호출 함수를 돌려준다. 입력은 상담 기록 문자열, 출력은 응답 문자열."""
    if provider == "claude":
        from anthropic import Anthropic
        client = Anthropic()
        model = MODEL or "claude-sonnet-5-5"

        def call(text):
            r = client.messages.create(model=model, max_tokens=600, system=SYSTEM,
                                       messages=[{"role": "user", "content": text}])
            return r.content[0].text
        return call
    if not MODEL:
        sys.exit("MODEL 환경 변수에 사용할 모델 이름을 넣어 주세요 (공식 문서 확인).")
    if provider == "openai":
        from openai import OpenAI
        client = OpenAI()

        def call(text):
            r = client.chat.completions.create(model=MODEL, messages=[
                {"role": "system", "content": SYSTEM}, {"role": "user", "content": text}])
            return r.choices[0].message.content
        return call
    if provider == "gemini":
        from google import genai
        client = genai.Client()

        def call(text):
            r = client.models.generate_content(model=MODEL, contents=text,
                                               config={"system_instruction": SYSTEM})
            return r.text
        return call
    sys.exit("회사이름은 claude, openai, gemini 중 하나여야 합니다.")


if os.environ.get("PROMPT_FILE"):
    SYSTEM = open(os.environ["PROMPT_FILE"], encoding="utf-8").read()
    if "client_state" in SYSTEM and "client_state" not in REQUIRED:
        REQUIRED.insert(2, "client_state")  # 4항목 프롬프트면 필드도 4개 확인


def load_records(path, ids):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = {r["session_id"]: r for r in csv.DictReader(f)}
    return [rows[i] for i in ids]


def parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    return json.loads(text)


def main():
    if len(sys.argv) < 4:
        print("사용법: python api_test.py 회사이름 session.csv SE03 SE02 ...")
        return
    provider = sys.argv[1].lower()
    call = make_caller(provider)
    records = load_records(sys.argv[2], sys.argv[3:])
    results = []
    for rec in records:
        start = time.time()
        try:
            text = call(rec["record_text"])
            sec = round(time.time() - start, 2)
            try:
                data = parse_json(text)
                json_ok = True
                fields_ok = all(k in data and str(data[k]).strip() for k in REQUIRED)
            except (json.JSONDecodeError, ValueError):
                data, json_ok, fields_ok = None, False, False
        except Exception as e:  # 호출 실패도 결과로 기록한다
            sec, text, data, json_ok, fields_ok = round(time.time() - start, 2), str(e), None, False, False
        results.append({
            "session_id": rec["session_id"],
            "seconds": sec,
            "json_ok": json_ok,
            "fields_ok": fields_ok,
            "response": json.dumps(data, ensure_ascii=False) if data else text,
        })
        print(rec["session_id"], f"{sec}초", "JSON 정상" if json_ok else "JSON 오류", "필드 정상" if fields_ok else "필드 누락")

    out = f"api_test_result_{provider}{os.environ.get('RESULT_TAG', '')}.csv"
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)
    print(f"결과를 {out}에 저장했습니다. 원문과 요약을 직접 대조해 누락·왜곡을 확인하세요.")


if __name__ == "__main__":
    main()
