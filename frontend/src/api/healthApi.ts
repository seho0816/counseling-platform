/**
 * GET /api/health — 서버가 켜져 있는지 확인한다(공개 API, 응답 본문 'OK').
 * 로그인 화면에서 "서버 연결 상태"를 보여주는 데 쓴다.
 */
export async function checkServer(): Promise<'ok' | 'down'> {
  try {
    const response = await fetch('/api/health', { credentials: 'include' });
    if (!response.ok) return 'down';
    return (await response.text()).trim() === 'OK' ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}
