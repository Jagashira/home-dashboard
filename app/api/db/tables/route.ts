import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/lib/config";
import { listTables } from "@/lib/db-browser";

export async function GET() {
  try {
    const tables = listTables();
    return NextResponse.json({
      ok: true,
      databasePath: APP_CONFIG.databasePath,
      databaseCount: 1,
      tableCount: tables.length,
      tables
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
