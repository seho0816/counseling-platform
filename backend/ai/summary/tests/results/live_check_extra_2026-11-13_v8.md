# AI 요약 서버 추가 검증 (네트워크 오류, 시간 초과, 호출 한도)

- 실행: 2026-11-13 15:57, 프롬프트: v8

| 항목 | 기대 | 실제 | 판정 | 메모 |
| --- | --- | --- | --- | --- |
| 네트워크 오류(연결 차단) | 502 AI_UNAVAILABLE, manualInput true | 502 AI_UNAVAILABLE True (2.1초) | 통과 | 프록시를 막아 실제 연결 실패를 만듦 |
| 시간 초과(제한 0.05초) | 502 AI_UNAVAILABLE, manualInput true, 5초 안에 끝남 | 502 AI_UNAVAILABLE True (0.1초) | 통과 | 제한 시간 옵션이 실제로 적용되는지 확인 |
| 호출 한도(429) | 30번 안에 429 | 30번 호출, 429 없음; 그 밖의 응답: 1번째 502 AI_UNAVAILABLE [ServerError code=504 status=DEADLINE_EXCEEDED]; 5번째 502 AI_UNAVAILABLE [ServerError code=504 status=DEADLINE_EXCEEDED] | 확인 못 함 | 한도에 닿지 않았거나 다른 오류(AI_UNAVAILABLE 등)가 먼저 나옴. 한도 시험으로는 인정하지 않는다 |
