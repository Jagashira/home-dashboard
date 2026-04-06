import { NextResponse } from "next/server";
import { fetchGmailSummary, getStoredGmailConnection } from "@/lib/gmail";
import { getJobHuntingStaticData } from "@/lib/job-hunting";

export async function GET() {
  try {
    const staticData = getJobHuntingStaticData();
    const connection = getStoredGmailConnection();
    const summary = await fetchGmailSummary(staticData.mail.searchPresets);

    return NextResponse.json({
      ok: true,
      connected: Boolean(connection),
      summary,
      connectUrl: "/api/gmail/auth/start",
      disconnectUrl: "/api/gmail/disconnect"
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed to fetch gmail status" },
      { status: 500 }
    );
  }
}
