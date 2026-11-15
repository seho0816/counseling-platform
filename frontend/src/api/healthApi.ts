/**
 * GET /api/health — 서버가 켜져 있는지 확인한다(공개 API, 응답 본문 'OK').
 * 로그인 화면에서 \"서버 연결 상태\"를 보여주는 데 쓴다.
 * 배포 서버가 잠들어 있으면 응답이 늦을 수 있어서 한 번에 8초까지만 기다린다.
 */
export async function checkServer(timeoutMs = 8000): Promise<'ok' | 'down'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/health', { credentials: 'include', signal: controller.signal });
    if (!response.ok) return 'down';
    return (await response.text()).trim() === 'OK' ? 'ok' : 'down';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
