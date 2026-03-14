import { NextRequest, NextResponse } from "next/server";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { getSettings, updateSettings } from "@/lib/repositories/settings";
import { listSources, updateSources } from "@/lib/repositories/sources";
import { listTopics, upsertTopics } from "@/lib/repositories/topics";

export async function GET() {
  try {
    ensureNewsBootstrap();
    return NextResponse.json({
      ok: true,
      settings: getSettings(),
      topics: listTopics(),
      sources: listSources()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    ensureNewsBootstrap();
    const payload = (await request.json()) as {
      settings?: { totalRequested?: number; days?: number; preferJapanese?: boolean };
      topics?: Array<{
        id?: number;
        name: string;
        query: string;
        isActive: boolean;
        allocationPercent: number;
        displayOrder: number;
      }>;
      sources?: Array<{ id: number; isActive: boolean; configJson?: string | null }>;
    };

    if (payload.settings) {
      updateSettings({
        totalRequested: Number(payload.settings.totalRequested ?? 30),
        days: Number(payload.settings.days ?? 1),
        preferJapanese: Boolean(payload.settings.preferJapanese ?? true)
      });
    }
    if (Array.isArray(payload.topics)) {
      upsertTopics(payload.topics);
    }
    if (Array.isArray(payload.sources)) {
      updateSources(payload.sources);
    }
    return NextResponse.json({
      ok: true,
      settings: getSettings(),
      topics: listTopics(),
      sources: listSources()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return PUT(request);
}

