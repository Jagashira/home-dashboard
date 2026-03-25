import { NextRequest, NextResponse } from "next/server";
import { getTableRows, updateTableRow } from "@/lib/db-browser";

type Params = {
  params: Promise<{ table: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { table } = await params;
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const limit = request.nextUrl.searchParams.get("limit") ?? undefined;

    return NextResponse.json({
      ok: true,
      ...getTableRows(table, query, limit ? Number(limit) : undefined)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: error instanceof Error && error.message === "table not found" ? 404 : 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { table } = await params;
    const payload = await request.json();

    const primaryKey =
      payload && typeof payload.primaryKey === "object" && payload.primaryKey !== null
        ? (payload.primaryKey as Record<string, unknown>)
        : null;
    const changes =
      payload && typeof payload.changes === "object" && payload.changes !== null
        ? (payload.changes as Record<string, unknown>)
        : null;

    if (!primaryKey || !changes) {
      return NextResponse.json(
        { ok: false, error: "primaryKey and changes are required" },
        { status: 400 }
      );
    }

    updateTableRow(table, primaryKey, changes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: error instanceof Error && error.message === "row not found" ? 404 : 400 }
    );
  }
}
