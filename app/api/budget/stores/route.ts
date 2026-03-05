import { NextRequest, NextResponse } from "next/server";
import { getExpenseStoreSuggestions } from "@/lib/budget";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "8");

    const items = await getExpenseStoreSuggestions(q, Number.isFinite(limit) ? limit : 8);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
