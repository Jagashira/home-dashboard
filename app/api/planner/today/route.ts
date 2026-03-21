import { NextResponse } from "next/server";
import { getPlannerSnapshot } from "@/lib/planner-data";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getPlannerSnapshot()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
