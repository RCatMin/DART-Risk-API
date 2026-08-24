import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.API_KEY;
const CORP_CODE = __ENV.CORP_CODE || "00126380"; // 삼성전자 (워치리스트 시드 데이터)

if (!API_KEY) {
  throw new Error("API_KEY 환경변수가 필요합니다 (예: npm run loadtest)");
}

const headers = { "x-api-key": API_KEY };

// 두 시나리오를 시간대를 나눠 순차 실행해서, 같은 서버 자원을 두고
// "캐시가 먹힐 때"와 "매번 DB를 타야 할 때"의 성능 차이를 분리해서 본다.
export const options = {
  scenarios: {
    cache_hit: {
      executor: "ramping-vus",
      exec: "cacheHit",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 20 },
        { duration: "20s", target: 20 },
        { duration: "5s", target: 0 },
      ],
    },
    cache_miss: {
      executor: "ramping-vus",
      exec: "cacheMiss",
      startVUs: 0,
      startTime: "35s",
      stages: [
        { duration: "10s", target: 20 },
        { duration: "20s", target: 20 },
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:cache_hit}": ["p(95)<50"],
    "http_req_duration{scenario:cache_miss}": ["p(95)<300"],
  },
};

// 항상 동일한 쿼리 -> Redis 캐시(TTL 30초) HIT을 유도
export function cacheHit() {
  const res = http.get(`${BASE_URL}/api/companies/${CORP_CODE}/disclosures`, {
    headers,
    tags: { scenario: "cache_hit" },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "X-Cache 헤더 존재": (r) => r.headers["X-Cache"] !== undefined,
  });
  sleep(0.1);
}

// VU/iteration 조합으로 offset을 만들어 전체 실행에서 절대 겹치지 않게 함 -> 매번 확실한 캐시 MISS
export function cacheMiss() {
  const offset = __VU * 100000 + __ITER;
  const res = http.get(`${BASE_URL}/api/risk-flags?limit=10&offset=${offset}`, {
    headers,
    tags: { scenario: "cache_miss" },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
  });
  sleep(0.1);
}
