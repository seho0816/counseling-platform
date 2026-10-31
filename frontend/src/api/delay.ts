/** Mock API에 네트워크 지연을 흉내 내기 위한 도우미. 백엔드 연동 시 함께 제거한다. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
