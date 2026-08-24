// Phase 4 DoD 검증용: 존재하지 않는 disclosureId로 extract job을 넣어서
// 재시도 정책(3회, exponential backoff)과 dead-letter 처리를 강제로 유발한다.
import { extractQueue } from "../queue/queues.js";

async function main() {
  const job = await extractQueue.add("extract", { disclosureId: 999999999 });
  console.log(`강제 실패 테스트 job 등록: id=${job.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
