import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

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
      name?: string;
      url?: string;
      purpose?: string;
      loginId?: string;
      password?: string;
      displayOrder?: number;
    } = {};

    const name = normalizeString(payload.name);
    if (name !== undefined) data.name = name;
    const url = normalizeString(payload.url);
    if (url !== undefined) data.url = url;
    const purpose = normalizeString(payload.purpose);
    if (purpose !== undefined) data.purpose = purpose;
    const loginId = normalizeString(payload.loginId);
    if (loginId !== undefined) data.loginId = loginId;
    if (typeof payload.password === "string") data.password = payload.password;
    const displayOrder = normalizeOrder(payload.displayOrder);
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const site = await prisma.jobSite.update({
      where: { id },
      data
    });

    return NextResponse.json({ ok: true, site });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.jobSite.delete({
      where: { id }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
