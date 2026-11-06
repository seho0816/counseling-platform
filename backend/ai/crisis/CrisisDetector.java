// 위기 표현 탐지 (Python 11_crisis_check.py를 Java로 옮긴 것)
// 사용: 챗봇 입력이 들어오면 AI를 호출하기 전에 detect()로 먼저 확인한다.
//   - 결과가 있으면(Optional이 비어 있지 않으면) AI를 호출하지 말고 고정 문구와 연락처를 보여 주고 상담사에게 알린다.
// 원칙: 놓치는 것보다 일상 표현을 잘못 잡는 쪽(오탐)이 안전하다. 목록은 시작용이며 자문으로 보완해야 한다.
// 패키지 선언은 프로젝트 구조에 맞게 바꾼다. 단독 실행(자체 시험): java CrisisDetector.java
package ai;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class CrisisDetector {

    private static final Map<String, List<String>> KEYWORDS = new LinkedHashMap<>();

    static {
        KEYWORDS.put("죽음·사라짐", List.of("죽고싶", "살기싫", "사라지고싶", "사라져버리고싶", "살고싶지않"));
        KEYWORDS.put("간접 표현", List.of("다끝내고싶", "다끝내버리고싶", "더는못버티", "더이상못버티"));
        KEYWORDS.put("자해", List.of("나를해치고싶", "스스로를해치고싶", "자해하고싶"));
        KEYWORDS.put("타인 위해", List.of("누군가를해치고싶", "다른사람을해치고싶", "해치고싶"));
    }

    private CrisisDetector() {
    }

    /** 공백과 문장부호를 지우고 소문자로 바꾼다. */
    static String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceAll("[\\s.,!?~\\-_'\"()\\[\\]…]+", "").toLowerCase();
    }

    /** 위기 표현이 있으면 분류 이름을, 없으면 빈 Optional을 돌려준다. */
    public static Optional<String> detect(String text) {
        String norm = normalize(text);
        for (Map.Entry<String, List<String>> e : KEYWORDS.entrySet()) {
            for (String w : e.getValue()) {
                if (norm.contains(w)) {
                    return Optional.of(e.getKey());
                }
            }
        }
        return Optional.empty();
    }

    // ---- 자체 시험 (Python 시험표와 같은 20개) ----
    private static final Object[][] CASES = {
        {"죽고 싶다", true}, {"요즘 너무 힘들어서 죽고싶어요", true}, {"살기 싫어요", true},
        {"그냥 사라지고 싶다", true}, {"다 끝내고 싶어요", true}, {"더는 못 버티겠어요", true},
        {"나를 해치고 싶은 생각이 들어요", true}, {"누군가를 해치고 싶어요", true},
        {"죽 고 싶 다", true}, {"죽고싶다!!!", true},
        {"배고파 죽겠어요", false}, {"시험 때문에 죽을 맛이에요", false}, {"더워 죽겠다", false},
        {"피곤해 죽겠어요 ㅠㅠ", false}, {"죽 먹고 싶어요", false},
        {"프로그램 신청은 어떻게 하나요?", false}, {"운영 시간이 어떻게 되나요", false},
        {"약 먹어도 돼요?", false}, {"상담을 대신 해 주세요", false}, {"초기 질문지는 어디서 작성하나요", false},
    };

    public static void main(String[] args) {
        int passed = 0;
        for (Object[] c : CASES) {
            String text = (String) c[0];
            boolean expected = (Boolean) c[1];
            Optional<String> result = detect(text);
            boolean ok = result.isPresent() == expected;
            if (ok) {
                passed++;
            }
            System.out.println("[" + (ok ? "통과" : "실패") + "] " + text + "  ->  " + result.orElse("감지 안 됨"));
        }
        System.out.println("\n" + passed + "/" + CASES.length + " 통과");
        if (passed != CASES.length) {
            System.exit(1);
        }
    }
}
