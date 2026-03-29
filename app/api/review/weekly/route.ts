import { NextResponse } from "next/server";
import { getWeeklyReview } from "@/lib/weekly-review";

export async function GET() {
  try {
    const review = await getWeeklyReview();
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
