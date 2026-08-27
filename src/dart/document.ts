import { unzipToText } from "../lib/zip.js";

interface ReportDocument {
  fileName: string;
  docName: string;
  text: string;
}

function stripTags(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDocuments(files: { name: string; content: string }[]): ReportDocument[] {
  return files.map((file) => ({
    fileName: file.name,
    docName: file.content.match(/<DOCUMENT-NAME[^>]*>(.*?)<\/DOCUMENT-NAME>/)?.[1]?.trim() ?? file.name,
    text: stripTags(file.content),
  }));
}

// 사업보고서 접수번호 하나의 zip 안에는 본문 외에 첨부된 감사보고서 / 연결감사보고서 등
// 여러 문서가 같이 들어있어서, report_nm과 같은 종류의 문서만 골라낸다.
export async function fetchReportText(rceptNo: string, reportNm: string): Promise<string> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY가 설정되지 않았습니다.");

  const res = await fetch(`https://opendart.fss.or.kr/api/document.xml?crtfc_key=${apiKey}&rcept_no=${rceptNo}`);
  if (!res.ok) throw new Error(`DART document.xml 요청 실패 (rcept_no=${rceptNo}): ${res.status}`);
  const zipBuffer = Buffer.from(await res.arrayBuffer());

  const documents = parseDocuments(unzipToText(zipBuffer));
  if (documents.length === 0) {
    throw new Error(`DART document.xml 응답에 문서가 없습니다 (rcept_no=${rceptNo})`);
  }

  const keyword = reportNm.includes("감사보고서")
    ? "감사보고서"
    : reportNm.includes("주요사항보고서")
      ? "주요사항보고서"
      : "사업보고서";
  const candidates = documents.filter((doc) => doc.docName.includes(keyword));
  const pool = candidates.length > 0 ? candidates : documents;

  // 후보가 여럿이면(예: 감사보고서 vs 연결감사보고서) 본문이 가장 긴 쪽을 채택
  return pool.reduce((longest, doc) => (doc.text.length >= longest.text.length ? doc : longest)).text;
}
