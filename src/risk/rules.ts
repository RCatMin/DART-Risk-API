export type RiskTypeKey =
  | "audit_opinion_adverse"
  | "embezzlement"
  | "litigation"
  | "management_designation"
  | "insolvency"
  | "dilution";
export type Severity = "low" | "medium" | "high";

export interface RuleFinding {
  riskType: RiskTypeKey;
  severity: Severity;
  confidence: number;
  sourceSnippet: string;
  summary: string;
}

interface RiskCategory {
  type: RiskTypeKey;
  keywords: string[];
  severity: Severity;
  boilerplateMarkers?: string[];
}

// CLAUDE.md에 고정된 7개 리스크 유형 중 "해당없음"을 제외한 6개.
// 소송은 사업보고서 필수 기재 항목이라 "해당사항 없습니다" 식 보일러플레이트가 대부분이라
// medium으로 두고, 나머지는 발생 자체가 심각한 이벤트라 high로 둔다.
// insolvency/dilution은 주요사항보고서 스코프 추가로 새로 생김: 부도·회생절차·해산은 존속 자체를
// 위협하는 이벤트라 high, 유상증자·전환사채/신주인수권부사채는 지분희석이라 관리종목지정 등보다는
// 한 단계 낮은 medium으로 둔다.
const RISK_CATEGORIES: RiskCategory[] = [
  { type: "audit_opinion_adverse", keywords: ["의견거절", "부적정의견", "한정의견", "감사범위제한"], severity: "high" },
  { type: "embezzlement", keywords: ["횡령", "배임"], severity: "high" },
  { type: "litigation", keywords: ["소송", "피소", "손해배상청구"], severity: "medium" },
  {
    type: "management_designation",
    keywords: ["관리종목", "상장폐지", "거래정지"],
    severity: "high",
    // 전환사채/신주인수권부사채의 조기상환(풋옵션) 조건 조항에 "지배권 변동(Change of Control) 발생 시
    // 상장폐지/거래정지되는 경우"처럼 가정법으로 등장한다 — 실제 상장폐지·관리종목 지정 사실이 아니라
    // 채권 발행 당시 정한 계약조건 나열이므로 제외.
    boilerplateMarkers: ["지배권 변동", "Change of Control"],
  },
  {
    type: "insolvency",
    keywords: ["부도", "회생절차", "파산신청", "해산사유"],
    severity: "high",
    // 재무제표 주석의 "신용위험" 회계정책 설명(매출채권 대손처리 기준)이나 신용등급 척도 정의문("투기적
    // 성향... 부도발생 가능")에도 "부도"가 관용구로 등장한다 — 실제 부도 발생 사실과는 무관하므로 제외.
    boilerplateMarkers: ["신용위험", "매출채권", "대손", "신용등급", "원리금"],
  },
  {
    type: "dilution",
    keywords: ["유상증자", "전환사채", "신주인수권부사채"],
    severity: "medium",
    // 사업보고서엔 정관상 신주인수권 배정 절차를 설명하는 상투적 조항이 항상 들어있는데,
    // 실제 유상증자/전환사채 발행 결정과는 무관하므로 제외.
    boilerplateMarkers: ["정관"],
  },
];

// 사업보고서는 "해당사항 없습니다" 식으로 키워드를 언급만 하고 부정하는 보일러플레이트가 많아서,
// 매칭 지점 주변에 부정 표현이 있으면 오탐지으로 간주하고 버린다.
const NEGATION_MARKERS = ["없습니다", "없음", "해당사항없음", "해당없음", "아닙니다", "아니다", "전무", "미해당"];
// "영업비밀보호법 위반, 횡령, 금품수수... 예방 교육"처럼 준법교육 커리큘럼을 나열하는 문장은
// 실제 사건이 아니라 사내 교육 안내문이라 걸러낸다.
const BOILERPLATE_MARKERS = ["교육", "가이드라인"];
const NEGATION_WINDOW = 40;

// "5배임을"(=5배+이다)처럼 숫자 뒤에 오는 "배"+"임"은 배임(횡령)과 무관한 우연한 substring 매칭이라 제외.
function isFalsePositiveMatch(text: string, keyword: string, index: number): boolean {
  if (keyword === "배임") {
    const prevChar = text[index - 1];
    if (prevChar !== undefined && /\d/.test(prevChar)) return true;
  }
  return false;
}

function hasNegationNearby(text: string, index: number, keywordLength: number): boolean {
  const start = Math.max(0, index - NEGATION_WINDOW);
  const end = Math.min(text.length, index + keywordLength + NEGATION_WINDOW);
  const context = text.slice(start, end);
  return NEGATION_MARKERS.some((marker) => context.includes(marker));
}

// stripTags()가 태그 경계를 \n으로 바꿔두기 때문에, 매칭 지점을 포함한 줄이 곧 문단/표 셀 단위다.
// 다만 개행 없이 아주 긴 문단으로 합쳐진 줄(예: 서술형 문단이 통째로 한 줄인 경우)에서는 매칭 지점이
// 줄 앞부분에서 500자 넘게 떨어져 있을 수 있어, 줄 시작이 아니라 매칭 지점을 중심으로 잘라야 실제
// 근거 문구가 스니펫에 포함된다.
const SNIPPET_WINDOW = 250;
function extractLine(text: string, index: number, keywordLength: number): string {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const nextBreak = text.indexOf("\n", index);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const windowStart = Math.max(lineStart, index - SNIPPET_WINDOW);
  const windowEnd = Math.min(lineEnd, index + keywordLength + SNIPPET_WINDOW);
  const withinLine = text.slice(windowStart, windowEnd).trim();
  if (withinLine.length >= MIN_SNIPPET_LENGTH) return withinLine;

  // 감사보고서제출처럼 라벨과 값이 서로 다른(아주 짧은) 줄에 나뉘어 있는 표 형식 문서는
  // 같은 줄만 봐서는 항상 MIN_SNIPPET_LENGTH 미만이라 버려진다 — 이 경우엔 줄 경계를 무시하고
  // 매칭 지점 주변 원문을 그대로 가져와 개행을 공백으로 접어서 라벨+값이 이어지게 만든다.
  const wideStart = Math.max(0, index - SNIPPET_WINDOW);
  const wideEnd = Math.min(text.length, index + keywordLength + SNIPPET_WINDOW);
  return text
    .slice(wideStart, wideEnd)
    .replace(/\s*\n\s*/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

// 재무제표 주석은 "소송충당부채", "주요 소송 금액"처럼 표 항목 라벨을 짧은 줄로 반복하는데,
// 이런 라벨은 실제 사건 서술이 아니라 양식 자체라서 최소 길이 미만은 버린다.
const MIN_SNIPPET_LENGTH = 40;
// 같은 문서에 같은 유형이 아주 많이 잡히는 경우(자회사별 반복 등) 대비, 유형별로 상한을 둔다.
const MAX_FINDINGS_PER_TYPE = 5;

export function evaluateRisk(rawText: string): RuleFinding[] {
  const byType = new Map<RiskTypeKey, RuleFinding[]>();
  const seenSnippets = new Set<string>();

  for (const category of RISK_CATEGORIES) {
    for (const keyword of category.keywords) {
      let index = rawText.indexOf(keyword);
      while (index !== -1) {
        if (!isFalsePositiveMatch(rawText, keyword, index) && !hasNegationNearby(rawText, index, keyword.length)) {
          const snippet = extractLine(rawText, index, keyword.length);
          const dedupeKey = `${category.type}:${snippet}`;
          const isBoilerplate =
            BOILERPLATE_MARKERS.some((marker) => snippet.includes(marker)) ||
            (category.boilerplateMarkers?.some((marker) => snippet.includes(marker)) ?? false);
          if (snippet.length >= MIN_SNIPPET_LENGTH && !isBoilerplate && !seenSnippets.has(dedupeKey)) {
            seenSnippets.add(dedupeKey);
            const group = byType.get(category.type) ?? [];
            group.push({
              riskType: category.type,
              severity: category.severity,
              confidence: 0.8,
              sourceSnippet: snippet,
              summary: `"${keyword}" 관련 문구 발견: ${snippet.slice(0, 120)}${snippet.length > 120 ? "..." : ""}`,
            });
            byType.set(category.type, group);
          }
        }
        index = rawText.indexOf(keyword, index + keyword.length);
      }
    }
  }

  const findings: RuleFinding[] = [];
  for (const group of byType.values()) {
    // 길이가 긴(=더 서술적인) 스니펫을 우선 채택
    group.sort((a, b) => b.sourceSnippet.length - a.sourceSnippet.length);
    findings.push(...group.slice(0, MAX_FINDINGS_PER_TYPE));
  }
  return findings;
}
