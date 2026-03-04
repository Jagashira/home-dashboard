import { NextResponse } from "next/server";
import { refreshNewsFromFeeds } from "@/lib/news";

export async function POST() {
  try {
    const result = await refreshNewsFromFeeds();

    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
