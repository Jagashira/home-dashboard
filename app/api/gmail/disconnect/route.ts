import { NextResponse } from "next/server";
import { clearGmailConnection } from "@/lib/gmail";

export async function POST() {
  try {
    clearGmailConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed to disconnect gmail" },
      { status: 500 }
    );
  }
}
