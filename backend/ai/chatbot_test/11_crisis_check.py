"""위기 표현 탐지 함수와 시험표 (AI를 호출하기 전에 코드가 먼저 확인한다)

사용법
  python 11_crisis_check.py            # 시험표를 실행하고 결과를 crisis_test_result.csv에 저장
백엔드에서는 detect_crisis(text)만 가져다 쓴다.
  분류가 돌아오면(None이 아니면) AI를 호출하지 말고 고정 문구를 보여 주고 상담사에게 알린다.

원칙
  - 위기 표현을 놓치는 것보다 일상 표현을 잘못 잡는 쪽이 안전하다(오탐 허용).
  - 아래 목록은 시작용이다. 담당 교수님 또는 상담 현장 경험자의 자문으로 보완해야 한다.
  - 키워드 방식은 완전하지 않다. 목록에 없는 표현은 놓칠 수 있다.
"""
import csv
import re

# 공백과 문장부호를 지운 뒤 비교하므로 '죽 고 싶 다', '죽고싶다!'도 잡힌다.
KEYWORDS = {
    "죽음·사라짐": ["죽고싶", "살기싫", "사라지고싶", "사라져버리고싶", "살고싶지않"],
    "간접 표현": ["다끝내고싶", "다끝내버리고싶", "더는못버티", "더이상못버티"],
    "자해": ["나를해치고싶", "스스로를해치고싶", "자해하고싶"],
    "타인 위해": ["누군가를해치고싶", "다른사람을해치고싶", "해치고싶"],
}


def normalize(text: str) -> str:
    """공백, 문장부호를 지우고 소문자로 바꾼다."""
    return re.sub(r"[\s\.,!?~\-_'\"()\[\]…]+", "", text).lower()


def detect_crisis(text: str):
    """위기 표현이 있으면 분류 이름을, 없으면 None을 돌려준다."""
    norm = normalize(text)
    for category, words in KEYWORDS.items():
        if any(w in norm for w in words):
            return category
    return None


# (입력, 위기 표현이어야 하는가, 구분)
CASES = [
    ("죽고 싶다", True, "직접 표현"),
    ("요즘 너무 힘들어서 죽고싶어요", True, "직접 표현"),
    ("살기 싫어요", True, "직접 표현"),
    ("그냥 사라지고 싶다", True, "직접 표현"),
    ("다 끝내고 싶어요", True, "간접 표현"),
    ("더는 못 버티겠어요", True, "간접 표현"),
    ("나를 해치고 싶은 생각이 들어요", True, "자해"),
    ("누군가를 해치고 싶어요", True, "타인 위해"),
    ("죽 고 싶 다", True, "띄어쓰기 변형"),
    ("죽고싶다!!!", True, "문장부호 변형"),
    ("배고파 죽겠어요", False, "일상 표현"),
    ("시험 때문에 죽을 맛이에요", False, "일상 표현"),
    ("더워 죽겠다", False, "일상 표현"),
    ("피곤해 죽겠어요 ㅠㅠ", False, "일상 표현"),
    ("죽 먹고 싶어요", False, "일상 표현(음식)"),
    ("프로그램 신청은 어떻게 하나요?", False, "일반 문의"),
    ("운영 시간이 어떻게 되나요", False, "일반 문의"),
    ("약 먹어도 돼요?", False, "범위 밖 문의(위기 아님)"),
    ("상담을 대신 해 주세요", False, "범위 밖 문의(위기 아님)"),
    ("초기 질문지는 어디서 작성하나요", False, "일반 문의"),
]


def run_tests(path="crisis_test_result.csv"):
    rows, passed = [], 0
    for text, expected, kind in CASES:
        result = detect_crisis(text)
        ok = (result is not None) == expected
        passed += ok
        rows.append({"입력": text, "구분": kind, "위기여야 함": "예" if expected else "아니오",
                     "감지 결과": result or "감지 안 됨", "통과": "통과" if ok else "실패"})
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"[{r['통과']}] {r['입력']}  ->  {r['감지 결과']}")
    print(f"\n{passed}/{len(CASES)} 통과, 결과는 {path}에 저장했습니다.")
    return passed == len(CASES)


if __name__ == "__main__":
    run_tests()
