// CLAUDE.md 스코프: 모든 응답에 투자 자문이 아니라는 disclaimer를 포함해야 함.
const DISCLAIMER = "본 API가 제공하는 정보는 투자 자문이 아니라 참고용 정보입니다.";

export function ok(data: unknown, extraMeta: Record<string, unknown> = {}) {
  return {
    data,
    meta: { disclaimer: DISCLAIMER, ...extraMeta },
  };
}

export function errorBody(message: string) {
  return {
    error: message,
    meta: { disclaimer: DISCLAIMER },
  };
}
