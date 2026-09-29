import { prisma } from "../lib/prisma";
import { getTimeTreeOutboundStatus, runTimeTreeOutboundDryRun } from "../lib/timetree/outbound-service";

async function main() {
  const command = process.argv[2];
  if (command === "status") {
    console.log(JSON.stringify(await getTimeTreeOutboundStatus(), null, 2));
    return;
  }
  if (command === "run") {
    if (!process.argv.includes("--dry-run")) {
      throw new Error("Phase 1ではTimeTree実書き込みは無効です。runには --dry-run が必要です。");
    }
    console.log(JSON.stringify(await runTimeTreeOutboundDryRun(), null, 2));
    return;
  }
  throw new Error("Usage: timetree:outbound <status|run --dry-run>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
