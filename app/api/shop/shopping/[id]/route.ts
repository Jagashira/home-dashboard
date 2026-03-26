import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

function parseOptionalQuantity(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0.1, parsed);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();

    const current = await prisma.shoppingItem.findUnique({
      where: { id },
      include: { inventoryItem: true }
    });

    if (!current) {
      return NextResponse.json({ ok: false, error: "shopping item not found" }, { status: 404 });
    }

    const quantity = parseOptionalQuantity(payload.quantity);
    const nextStatus = payload.status === "todo" || payload.status === "done" ? payload.status : undefined;
    const wasDone = current.status === "done";
    const willBeDone = nextStatus === "done";

    const data: {
      name?: string;
      quantity?: number;
      unit?: string;
      status?: string;
      store?: string | null;
      note?: string | null;
      purchasedAt?: Date | null;
    } = {};

    if (typeof payload.name === "string") data.name = payload.name.trim();
    if (quantity !== undefined) data.quantity = quantity;
    if (typeof payload.unit === "string") data.unit = payload.unit.trim();
    if (typeof payload.store === "string") data.store = payload.store.trim() || null;
    if (typeof payload.note === "string") data.note = payload.note.trim() || null;
    if (nextStatus) {
      data.status = nextStatus;
      data.purchasedAt = nextStatus === "done" ? new Date() : null;
    }

    const nextQuantity = quantity ?? current.quantity;

    const item = await prisma.$transaction(async (tx) => {
      if (!wasDone && willBeDone && current.inventoryItemId) {
        await tx.inventoryItem.update({
          where: { id: current.inventoryItemId },
          data: {
            currentQuantity: { increment: nextQuantity }
          }
        });
      }

      return tx.shoppingItem.update({
        where: { id },
        data
      });
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
    await prisma.shoppingItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
