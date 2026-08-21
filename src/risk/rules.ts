export type RiskTypeKey = "audit_opinion_adverse" | "embezzlement" | "litigation" | "management_designation";
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
}

// CLAUDE.md에 고정된 5개 리스크 유형 중 "해당없음"을 제외한 4개.
// 소송은 사업보고서 필수 기재 항목이라 "해당사항 없습니다" 식 보일러플레이트가 대부분이라
// medium으로 두고, 나머지는 발생 자체가 심각한 이벤트라 high로 둔다.
const RISK_CATEGORIES: RiskCategory[] = [
  { type: "audit_opinion_adverse", keywords: ["의견거절", "부적정의견", "한정의견", "감사범위제한"], severity: "high" },
  { type: "embezzlement", keywords: ["횡령", "배임"], severity: "high" },
  { type: "litigation", keywords: ["소송", "피소", "손해배상청구"], severity: "medium" },
  { type: "management_designation", keywords: ["관리종목", "상장폐지", "거래정지"], severity: "high" },
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
function extractLine(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const nextBreak = text.indexOf("\n", index);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return text.slice(lineStart, lineEnd).trim();
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
          const snippet = extractLine(rawText, index).slice(0, 500);
          const dedupeKey = `${category.type}:${snippet}`;
          const isBoilerplate = BOILERPLATE_MARKERS.some((marker) => snippet.includes(marker));
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
