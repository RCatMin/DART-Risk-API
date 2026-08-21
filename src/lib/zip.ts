import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface UnzippedFile {
  name: string;
  content: string;
}

// DART가 zip으로만 파일을 내려주는 API가 여럿(corpCode.xml, document.xml)이라 공용으로 분리.
export function unzipToText(zipBuffer: Buffer): UnzippedFile[] {
  if (zipBuffer.subarray(0, 2).toString() !== "PK") {
    throw new Error(`zip 형식이 아닙니다: ${zipBuffer.toString("utf-8").slice(0, 200)}`);
  }

  const dir = mkdtempSync(join(tmpdir(), "dart-zip-"));
  try {
    const zipPath = join(dir, "archive.zip");
    writeFileSync(zipPath, zipBuffer);
    execFileSync("unzip", ["-o", zipPath, "-d", dir]);
    return readdirSync(dir)
      .filter((name) => name !== "archive.zip")
      .map((name) => ({ name, content: readFileSync(join(dir, name), "utf-8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
