import { GoogleGenAI, Type } from "@google/genai";
import type { RiskTypeKey, RuleFinding, Severity } from "../risk/rules.js";

const RISK_TYPE_ENUM: RiskTypeKey[] = [
  "audit_opinion_adverse",
  "embezzlement",
  "litigation",
  "management_designation",
  "insolvency",
  "dilution",
];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          candidateIndex: { type: Type.INTEGER, description: "입력 후보 목록의 번호(1부터 시작)" },
          riskType: { type: Type.STRING, enum: RISK_TYPE_ENUM },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          isRealRisk: { type: Type.BOOLEAN, description: "보일러플레이트/부정문이 아니라 실제 리스크인지" },
          confidence: { type: Type.NUMBER, description: "0~1 사이 확신도" },
          summary: { type: Type.STRING, description: "판단 근거를 한국어 한두 문장으로" },
        },
        required: ["candidateIndex", "riskType", "severity", "isRealRisk", "confidence", "summary"],
      },
    },
  },
  required: ["findings"],
};

interface GeminiFinding {
  candidateIndex: number;
  riskType: RiskTypeKey;
  severity: Severity;
  isRealRisk: boolean;
  confidence: number;
  summary: string;
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function buildPrompt(context: { corpName: string; reportNm: string }, candidates: RuleFinding[]): string {
  const list = candidates
    .map((c, i) => `${i + 1}. [룰 엔진 분류: ${c.riskType}] ${c.sourceSnippet}`)
    .join("\n\n");

  return `당신은 한국 상장사 전자공시(DART)를 검토하는 리스크 애널리스트입니다.
아래는 "${context.corpName}"의 공시("${context.reportNm}")에서 키워드 기반 룰 엔진이 찾아낸 리스크 후보 목록입니다.
각 후보가 실제 리스크가 맞는지 원문 맥락으로 판단하세요.

다음과 같은 경우 isRealRisk를 false로 표시하세요:
- "해당사항 없습니다" 식으로 키워드를 언급만 하고 부정하는 문장
- 재무제표 주석의 일반적인 회계정책 설명(예: 대손처리 기준, 신용위험 관리방침)
- 정관 조항이나 사채 발행조건 같은 계약상 조건문("~하는 경우" 등 가정법) — 실제 발생한 사실이 아님
- 사내 교육/가이드라인 안내문

실제 리스크로 판단되면, 룰 엔진이 고정해둔 심각도(severity)에 얽매이지 말고 원문 내용(금액 규모, 회사의 자체 평가, 사건의 확정 여부 등)을 근거로 직접 다시 판단하세요.

후보 목록:
${list}`;
}

// 룰 엔진이 이미 후보로 걸러낸 findings만 Gemini에게 재확인시킨다.
// 후보가 없는(=키워드 매칭이 아예 없는) 공시는 호출 대상에서 아예 제외해 호출량과 비용을 최소화한다.
export async function confirmWithGemini(
  context: { corpName: string; reportNm: string },
  candidates: RuleFinding[],
): Promise<RuleFinding[]> {
  if (candidates.length === 0) return [];

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: buildPrompt(context, candidates),
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini 응답이 비어있습니다.");

  const parsed = JSON.parse(text) as { findings: GeminiFinding[] };

  return parsed.findings
    .filter((f) => f.isRealRisk)
    .map((f) => ({
      riskType: f.riskType,
      severity: f.severity,
      confidence: f.confidence,
      summary: `[Gemini 확인] ${f.summary}`,
      sourceSnippet: candidates[f.candidateIndex - 1]?.sourceSnippet ?? "",
    }));
}
