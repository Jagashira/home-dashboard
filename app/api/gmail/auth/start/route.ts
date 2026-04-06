import { NextResponse } from "next/server";
import { createGmailAuthUrl } from "@/lib/gmail";

export async function GET() {
  try {
    const url = await createGmailAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed to create auth url" },
      { status: 500 }
    );
  }
}
