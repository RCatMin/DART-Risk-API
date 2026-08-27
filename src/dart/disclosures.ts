export interface DisclosureItem {
  rceptNo: string;
  corpCode: string;
  reportNm: string;
  rceptDt: string; // yyyyMMdd
}

interface DartListItem {
  rcept_no: string;
  corp_code: string;
  report_nm: string;
  rcept_dt: string;
}

// CLAUDE.md 스코프: 사업보고서 / 감사보고서 / 주요사항보고서 3종 대상
const TARGET_REPORT_KEYWORDS = ["사업보고서", "감사보고서", "주요사항보고서"];

export async function fetchDisclosures(params: {
  corpCode: string;
  bgnDe: string;
  endDe: string;
}): Promise<DisclosureItem[]> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY가 설정되지 않았습니다.");

  const results: DisclosureItem[] = [];
  const pageCount = 100;
  let pageNo = 1;

  for (;;) {
    const url = new URL("https://opendart.fss.or.kr/api/list.json");
    url.searchParams.set("crtfc_key", apiKey);
    url.searchParams.set("corp_code", params.corpCode);
    url.searchParams.set("bgn_de", params.bgnDe);
    url.searchParams.set("end_de", params.endDe);
    url.searchParams.set("page_no", String(pageNo));
    url.searchParams.set("page_count", String(pageCount));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`DART list.json 요청 실패: ${res.status}`);
    const json = await res.json();

    if (json.status === "013") break; // 조회된 데이터 없음
    if (json.status !== "000") {
      throw new Error(`DART list.json 오류 (corp_code=${params.corpCode}): ${json.status} ${json.message}`);
    }

    const items = (json.list ?? []) as DartListItem[];
    for (const item of items) {
      if (TARGET_REPORT_KEYWORDS.some((keyword) => item.report_nm.includes(keyword))) {
        results.push({
          rceptNo: item.rcept_no,
          corpCode: item.corp_code,
          reportNm: item.report_nm,
          rceptDt: item.rcept_dt,
        });
      }
    }

    if (items.length < pageCount) break;
    pageNo++;
  }

  return results;
}
