import { prisma } from "../lib/prisma";
import {
  getGoogleCalendarOutboundStatus,
  runGoogleCalendarOutbound
} from "../lib/google-calendar/outbound-service";
import { createGoogleCalendarOutboundClient } from "../lib/google-calendar/write-client";
import {
  createOutboundAuthorizationUrl,
  exchangeOutboundAuthorizationRedirect
} from "../lib/google-calendar/outbound-oauth";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "auth-url") {
    console.log("次のURLをブラウザで開き、outbound専用のGoogle認証を完了してください。CAPTCHAや2FAは回避しません。\n");
    console.log(await createOutboundAuthorizationUrl());
    console.log("\nリダイレクト後のURLを oauth-exchange --redirect-url に渡してください。有効期限は15分です。");
    return;
  }
  if (command === "oauth-exchange") {
    if (option("--confirm") !== "WRITE_ENV") throw new Error("oauth-exchangeには --confirm WRITE_ENV が必要です。");
    const redirectUrl = option("--redirect-url");
    if (!redirectUrl) throw new Error("oauth-exchangeには --redirect-url が必要です。");
    console.log(JSON.stringify(await exchangeOutboundAuthorizationRedirect(redirectUrl), null, 2));
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(await getGoogleCalendarOutboundStatus(), null, 2));
    return;
  }
  if (command === "run") {
    const dryRun = process.argv.includes("--dry-run");
    const result = await runGoogleCalendarOutbound(
      createGoogleCalendarOutboundClient({ allowReadOnlyFallbackForDryRun: dryRun }),
      {
        dryRun,
        confirmation: option("--confirm")
      }
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error("Usage: google-calendar:outbound <auth-url|oauth-exchange|status|run --dry-run|run --confirm WRITE_GOOGLE_CALENDAR>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
