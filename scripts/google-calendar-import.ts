import { prisma } from "../lib/prisma";
import {
  applyGoogleImportPreview,
  createGoogleImportPreview,
  discoverGoogleCalendars,
  getGoogleImportStatus,
  listGoogleImportRuns
} from "../lib/google-calendar/import-service";
import { createGoogleCalendarReadClient } from "../lib/google-calendar/read-client";
import {
  createReadOnlyAuthorizationUrl,
  exchangeReadOnlyAuthorizationRedirect
} from "../lib/google-calendar/oauth";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "auth-url") {
    console.log("次のURLをブラウザで開き、通常のGoogle認証を完了してください。CAPTCHAや2FAは回避しません。\n");
    console.log(await createReadOnlyAuthorizationUrl());
    console.log("\nリダイレクト後のURLを oauth-exchange --redirect-url に渡してください。有効期限は15分です。");
    return;
  }
  if (command === "oauth-exchange") {
    if (argument("--confirm") !== "WRITE_ENV") throw new Error("oauth-exchangeには --confirm WRITE_ENV が必要です。");
    const redirectUrl = argument("--redirect-url");
    if (!redirectUrl) throw new Error("oauth-exchangeには --redirect-url が必要です。");
    console.log(JSON.stringify(await exchangeReadOnlyAuthorizationRedirect(redirectUrl), null, 2));
    return;
  }
  if (command === "discovery" || command === "calendars") {
    const result = await discoverGoogleCalendars(createGoogleCalendarReadClient());
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === "preview") {
    const before = await prisma.organizerEvent.count();
    const result = await createGoogleImportPreview(createGoogleCalendarReadClient());
    const after = await prisma.organizerEvent.count();
    console.log(JSON.stringify({ ...result, organizerEventCountBefore: before, organizerEventCountAfter: after }, null, 2));
    return;
  }
  if (command === "apply") {
    if (argument("--confirm") !== "IMPORT") throw new Error("applyには --confirm IMPORT が必要です。");
    const runId = argument("--run");
    const confirmationToken = argument("--token");
    if (!runId || !confirmationToken) throw new Error("applyには --run と --token が必要です。");
    console.log(JSON.stringify(await applyGoogleImportPreview({ runId, confirmationToken }), null, 2));
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(await getGoogleImportStatus(), null, 2));
    return;
  }
  if (command === "runs") {
    console.log(JSON.stringify(await listGoogleImportRuns(), null, 2));
    return;
  }
  throw new Error("Usage: google-calendar:import <auth-url|oauth-exchange|discovery|preview|status|runs|apply>");
}

main()
  .catch((error) => {
    console.error("GOOGLE_CALENDAR_IMPORT_ERROR", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
