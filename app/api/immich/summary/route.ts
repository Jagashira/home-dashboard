import { NextResponse } from "next/server";
import { getImmichSummary } from "@/lib/immich";

export async function GET() {
  try {
    const summary = await getImmichSummary();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
