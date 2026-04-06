import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultJobSites } from "@/lib/job-sites";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrder(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

export async function GET() {
  try {
    await ensureDefaultJobSites();
    const sites = await prisma.jobSite.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });
    return NextResponse.json({ ok: true, sites });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const name = normalizeString(payload.name);
    const url = normalizeString(payload.url);
    const purpose = normalizeString(payload.purpose);
    const loginId = normalizeString(payload.loginId);
    const password = typeof payload.password === "string" ? payload.password : "";
    const displayOrder = normalizeOrder(payload.displayOrder, 0);

    if (!name || !purpose || !url) {
      return NextResponse.json({ ok: false, error: "name/url/purpose are required" }, { status: 400 });
    }

    const site = await prisma.jobSite.create({
      data: {
        name,
        url,
        purpose,
        loginId,
        password,
        displayOrder
      }
    });

    return NextResponse.json({ ok: true, site });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
