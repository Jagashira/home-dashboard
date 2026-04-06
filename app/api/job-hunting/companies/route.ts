import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultJobCompanies } from "@/lib/job-companies";
import { COMPANY_STATUS_OPTIONS } from "@/lib/job-hunting";

const VALID_STATUS = new Set(COMPANY_STATUS_OPTIONS.map((option) => option.value));

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
    await ensureDefaultJobCompanies();
    const companies = await prisma.jobCompany.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });
    return NextResponse.json({ ok: true, companies });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const companyName = normalizeString(payload.companyName);
    const myPageUrl = normalizeString(payload.myPageUrl);
    const loginId = normalizeString(payload.loginId);
    const password = typeof payload.password === "string" ? payload.password : "";
    const status = normalizeString(payload.status);
    const displayOrder = normalizeOrder(payload.displayOrder, 0);

    if (!companyName || !myPageUrl || !VALID_STATUS.has(status as typeof COMPANY_STATUS_OPTIONS[number]["value"])) {
      return NextResponse.json({ ok: false, error: "companyName/myPageUrl/status are required" }, { status: 400 });
    }

    const company = await prisma.jobCompany.create({
      data: { companyName, myPageUrl, loginId, password, status, displayOrder }
    });

    return NextResponse.json({ ok: true, company });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
