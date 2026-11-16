/** 내담자 입장처럼 서버 없이 동작하는 부분에 짧은 지연을 주는 도우미 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
