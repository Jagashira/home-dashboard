import { prisma } from "../lib/prisma";
import {
  getGoogleCalendarOutboundStatus,
  runGoogleCalendarOutbound
} from "../lib/google-calendar/outbound-service";
import { createGoogleCalendarOutboundClient } from "../lib/google-calendar/write-client";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "status") {
    console.log(JSON.stringify(await getGoogleCalendarOutboundStatus(), null, 2));
    return;
  }
  if (command === "run") {
    const result = await runGoogleCalendarOutbound(
      createGoogleCalendarOutboundClient(),
      {
        dryRun: process.argv.includes("--dry-run"),
        confirmation: option("--confirm")
      }
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error("Usage: google-calendar:outbound <status|run --dry-run|run --confirm WRITE_GOOGLE_CALENDAR>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
