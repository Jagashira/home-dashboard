import { NextResponse } from "next/server";
import { fetchNewsAndSummarize } from "@/lib/news-dashboard";

export async function POST() {
  try {
    const result = await fetchNewsAndSummarize();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

