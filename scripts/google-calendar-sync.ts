import { prisma } from "../lib/prisma";
import { createGoogleCalendarReadClient } from "../lib/google-calendar/read-client";
import {
  getGoogleCalendarSyncStatus,
  runGoogleCalendarIncrementalSync
} from "../lib/google-calendar/sync-service";

async function main() {
  const command = process.argv[2];
  if (command === "status") {
    console.log(JSON.stringify(await getGoogleCalendarSyncStatus(), null, 2));
    return;
  }
  if (command === "run") {
    const dryRun = process.argv.includes("--dry-run");
    const result = await runGoogleCalendarIncrementalSync(
      createGoogleCalendarReadClient(),
      { dryRun }
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error("Usage: google-calendar:sync <status|run [--dry-run]>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
