import { NextRequest, NextResponse } from "next/server";
import {
  getNewsDashboardSettings,
  parseAndNormalizeTopicInput,
  updateNewsDashboardSettings
} from "@/lib/news-dashboard";

export async function GET() {
  try {
    const settings = await getNewsDashboardSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

async function handleUpdate(request: NextRequest) {
  try {
    const payload = await request.json();
    const topics = await parseAndNormalizeTopicInput(payload.topics);
    const settings = await updateNewsDashboardSettings({
      totalRequested: Number(payload.totalRequested ?? 30),
      days: Number(payload.days ?? 1),
      topics
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return handleUpdate(request);
}

// Backward compatibility for existing UI.
export async function PATCH(request: NextRequest) {
  return handleUpdate(request);
}
