import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIG } from "@/lib/config";
import { getSystemStatusSummary } from "@/lib/system-status";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  if (!APP_CONFIG.systemStatusSecret) return true;
  const token =
    request.headers.get("x-system-status-secret") ||
    request.nextUrl.searchParams.get("secret") ||
    "";
  return token === APP_CONFIG.systemStatusSecret;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const status = await getSystemStatusSummary();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
