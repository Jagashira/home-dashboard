import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, freeBlocks: [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
