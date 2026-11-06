"""챗봇 시험 호출: 질문 20개를 챗봇 프롬프트로 보내 응답을 확인한다.

사용법 (11_crisis_check.py, 9_챗봇_프롬프트_v2.txt, 9_가상기관자료_v2.txt, 9_챗봇_시험질문.csv를 같은 폴더에 둔다)
  export GEMINI_API_KEY=키
  export MODEL=gemini-3.5-flash-lite
  python 9_chatbot_test.py
  프롬프트 v2로 돌릴 때(선택): export PROMPT_FILE=9_챗봇_프롬프트_v2.txt 와 export RESULT_TAG=_v2 를 먼저 입력
  기관 자료 v2로 돌릴 때(선택): export ORG_FILE=9_가상기관자료_v2.txt
  일부 질문만 다시 돌릴 때(선택): export ONLY=Q16,Q18
  호출 사이 대기 시간(초, 기본 4.5): export DELAY=4.5

위기 표현은 AI를 호출하기 전에 코드가 먼저 확인한다 (11_crisis_check.py의 detect_crisis).
결과는 chatbot_test_result.csv에 저장된다. 기대 동작과 응답은 사람이 직접 대조해서 판정한다.
"""
import csv
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def load_crisis():
    spec = importlib.util.spec_from_file_location("crisis", os.path.join(HERE, "11_crisis_check.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.detect_crisis


FIXED = ("지금 많이 힘드신 것 같아요. 혼자 견디지 않으셔도 괜찮아요. 기관 상담 연락처 02-0000-0000(가상), "
         "긴급한 위험이 있다면 119 또는 112, 자살예방 상담전화 109(시연 전 공식 안내에서 번호 확인)로 연락해 주세요. "
         "이 안내는 미리 정해진 문구이며 기관 상담자에게 알림이 전달되었습니다.")


def main():
    key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("MODEL")
    if not key or not model:
        sys.exit("GEMINI_API_KEY와 MODEL 환경 변수를 먼저 넣어 주세요.")
    from google import genai
    client = genai.Client()
    detect = load_crisis()
    prompt_name = os.environ.get("PROMPT_FILE", "9_챗봇_프롬프트_v2.txt")
    prompt = open(os.path.join(HERE, prompt_name), encoding="utf-8").read()
    print("사용한 프롬프트 파일:", prompt_name)
    org_name = os.environ.get("ORG_FILE", "9_가상기관자료_v2.txt")
    org = open(os.path.join(HERE, org_name), encoding="utf-8").read()
    print("사용한 기관 자료 파일:", org_name)
    system = prompt.replace("(여기에 가상 기관의 소개, 운영 시간, 프로그램 목록, 신청 절차를 붙여 넣는다)", org)
    rows = list(csv.DictReader(open(os.path.join(HERE, "9_챗봇_시험질문.csv"), encoding="utf-8-sig")))
    only = [q.strip() for q in os.environ.get("ONLY", "").split(",") if q.strip()]
    if only:
        rows = [r for r in rows if r["q_id"] in only]
        print("일부 질문만 실행:", only)
    delay = float(os.environ.get("DELAY", "4.5"))  # 무료 한도(분당 15회)를 넘지 않게 호출 사이에 쉰다
    out = []
    for r in rows:
        start = time.time()
        crisis = detect(r["question"])
        if crisis:
            answer, called = FIXED, "아니오(고정 응답)"
        else:
            answer, called = "", "예(실패)"
            for attempt in range(3):
                try:
                    resp = client.models.generate_content(model=model, contents=r["question"],
                                                          config={"system_instruction": system})
                    answer, called = resp.text, "예"
                    break
                except Exception as e:
                    answer, called = f"오류: {e}", "예(실패)"
                    if "429" in str(e) and attempt < 2:
                        print("  한도 초과, 45초 기다린 뒤 다시 시도합니다")
                        time.sleep(45)
                    else:
                        break
            time.sleep(delay)
        sec = round(time.time() - start, 2)
        out.append({"q_id": r["q_id"], "category": r["category"], "question": r["question"],
                    "expected_behavior": r["expected_behavior"], "AI 호출": called,
                    "seconds": sec, "answer": answer, "판정(직접 입력)": ""})
        print(r["q_id"], r["category"], f"{sec}초", "AI 호출:", called)
    out_name = f"chatbot_test_result{os.environ.get('RESULT_TAG', '')}.csv"
    with open(out_name, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(f"결과를 {out_name}에 저장했습니다. 기대 동작과 응답을 직접 대조해 판정을 적으세요.")


if __name__ == "__main__":
    main()
