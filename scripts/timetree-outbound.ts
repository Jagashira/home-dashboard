import { prisma } from "../lib/prisma";
import { getTimeTreeOutboundStatus, runTimeTreeOutbound } from "../lib/timetree/outbound-service";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "status") {
    console.log(JSON.stringify(await getTimeTreeOutboundStatus(), null, 2));
    return;
  }
  if (command === "run") {
    const dryRun = process.argv.includes("--dry-run");
    const limitValue = option("--limit");
    console.log(JSON.stringify(await runTimeTreeOutbound({
      dryRun,
      confirmation: option("--confirm"),
      limit: limitValue ? Number(limitValue) : undefined
    }), null, 2));
    return;
  }
  throw new Error("Usage: timetree:outbound <status|run --dry-run|run --confirm WRITE_TIMETREE --limit 1>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
