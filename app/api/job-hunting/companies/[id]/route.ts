import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMPANY_STATUS_OPTIONS } from "@/lib/job-hunting";

type Params = {
  params: Promise<{ id: string }>;
};

const VALID_STATUS = new Set(COMPANY_STATUS_OPTIONS.map((option) => option.value));

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeOrder(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round(parsed));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const data: {
      companyName?: string;
      myPageUrl?: string;
      loginId?: string;
      password?: string;
      storagePath?: string;
      status?: string;
      displayOrder?: number;
    } = {};

    const companyName = normalizeString(payload.companyName);
    if (companyName !== undefined) data.companyName = companyName;
    const myPageUrl = normalizeString(payload.myPageUrl);
    if (myPageUrl !== undefined) data.myPageUrl = myPageUrl;
    const loginId = normalizeString(payload.loginId);
    if (loginId !== undefined) data.loginId = loginId;
    if (typeof payload.password === "string") data.password = payload.password;
    const storagePath = normalizeString(payload.storagePath);
    if (storagePath !== undefined) data.storagePath = storagePath;
    const status = normalizeString(payload.status);
    if (status !== undefined && VALID_STATUS.has(status as typeof COMPANY_STATUS_OPTIONS[number]["value"])) data.status = status;
    const displayOrder = normalizeOrder(payload.displayOrder);
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const company = await prisma.jobCompany.update({ where: { id }, data });
    return NextResponse.json({ ok: true, company });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.jobCompany.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
