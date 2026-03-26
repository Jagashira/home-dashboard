import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

function parseOptionalQuantity(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, parsed);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();

    const data: {
      name?: string;
      category?: string | null;
      location?: string | null;
      unit?: string;
      currentQuantity?: number;
      minimumQuantity?: number;
      preferredBuyQuantity?: number;
      note?: string | null;
    } = {};

    if (typeof payload.name === "string") data.name = payload.name.trim();
    if (typeof payload.category === "string") data.category = payload.category.trim() || null;
    if (typeof payload.location === "string") data.location = payload.location.trim() || null;
    if (typeof payload.unit === "string") data.unit = payload.unit.trim();
    if (typeof payload.note === "string") data.note = payload.note.trim() || null;

    const currentQuantity = parseOptionalQuantity(payload.currentQuantity);
    if (currentQuantity !== undefined) data.currentQuantity = currentQuantity;

    const minimumQuantity = parseOptionalQuantity(payload.minimumQuantity);
    if (minimumQuantity !== undefined) data.minimumQuantity = minimumQuantity;

    const preferredBuyQuantity = parseOptionalQuantity(payload.preferredBuyQuantity);
    if (preferredBuyQuantity !== undefined) data.preferredBuyQuantity = Math.max(0.1, preferredBuyQuantity);

    const item = await prisma.inventoryItem.update({
      where: { id },
      data
    });

    return NextResponse.json({ ok: true, item });
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
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
