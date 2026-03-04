import { NextRequest, NextResponse } from "next/server";
import { getNewsPreferences, updateNewsPreferences } from "@/lib/news";

export async function GET() {
  try {
    const preferences = await getNewsPreferences();
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();

    const preferences = await updateNewsPreferences({
      keywords: typeof payload.keywords === "string" ? payload.keywords : undefined,
      feedUrls: typeof payload.feedUrls === "string" ? payload.feedUrls : undefined,
      maxItemsPerFeed:
        typeof payload.maxItemsPerFeed === "number" ? payload.maxItemsPerFeed : undefined,
      defaultPageSize:
        typeof payload.defaultPageSize === "number" ? payload.defaultPageSize : undefined,
      preferJapanese:
        typeof payload.preferJapanese === "boolean" ? payload.preferJapanese : undefined
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
