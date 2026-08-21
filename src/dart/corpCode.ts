import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CorpCodeEntry {
  corpCode: string;
  corpName: string;
  stockCode: string;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// DART가 corp_code -> stock_code 매핑을 zip(XML) 통짜 다운로드로만 제공해서,
// 상장 종목 하나 조회할 방법이 없어 전체를 받아 로컬에서 조회 테이블을 만든다.
export async function fetchCorpCodeMap(): Promise<Map<string, CorpCodeEntry>> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY가 설정되지 않았습니다.");

  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`);
  if (!res.ok) throw new Error(`DART corpCode.xml 요청 실패: ${res.status}`);
  const zipBuffer = Buffer.from(await res.arrayBuffer());

  if (zipBuffer.subarray(0, 2).toString() !== "PK") {
    throw new Error(`DART corpCode 응답이 zip이 아닙니다: ${zipBuffer.toString("utf-8").slice(0, 200)}`);
  }

  const dir = mkdtempSync(join(tmpdir(), "dart-corpcode-"));
  try {
    const zipPath = join(dir, "corpCode.zip");
    writeFileSync(zipPath, zipBuffer);
    execFileSync("unzip", ["-o", zipPath, "-d", dir]);
    const xml = readFileSync(join(dir, "CORPCODE.xml"), "utf-8");

    const map = new Map<string, CorpCodeEntry>();
    for (const match of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
      const block = match[1] ?? "";
      const corpCode = block.match(/<corp_code>(.*?)<\/corp_code>/)?.[1]?.trim();
      const corpName = block.match(/<corp_name>(.*?)<\/corp_name>/)?.[1]?.trim();
      const stockCode = block.match(/<stock_code>(.*?)<\/stock_code>/)?.[1]?.trim();
      if (corpCode && stockCode) {
        map.set(stockCode, { corpCode, corpName: decodeXmlEntities(corpName ?? ""), stockCode });
      }
    }
    return map;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
