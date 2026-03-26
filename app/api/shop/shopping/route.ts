import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseQuantity(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0.1, parsed);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const inventoryItemId = typeof payload.inventoryItemId === "string" ? payload.inventoryItemId : null;
    const store = typeof payload.store === "string" ? payload.store.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    let name = typeof payload.name === "string" ? payload.name.trim() : "";
    let unit = typeof payload.unit === "string" ? payload.unit.trim() : "";

    let inventoryItem: Awaited<ReturnType<typeof prisma.inventoryItem.findUnique>> = null;
    if (inventoryItemId) {
      inventoryItem = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!inventoryItem) {
        return NextResponse.json({ ok: false, error: "inventory item not found" }, { status: 404 });
      }
      if (!name) name = inventoryItem.name;
      if (!unit) unit = inventoryItem.unit;
    }

    if (!name || !unit) {
      return NextResponse.json({ ok: false, error: "name/unit are required" }, { status: 400 });
    }

    const quantity = parseQuantity(payload.quantity, inventoryItem?.preferredBuyQuantity ?? 1);

    const existingOpenItem = inventoryItemId
      ? await prisma.shoppingItem.findFirst({
          where: {
            inventoryItemId,
            status: "todo"
          }
        })
      : null;

    if (existingOpenItem) {
      const item = await prisma.shoppingItem.update({
        where: { id: existingOpenItem.id },
        data: {
          quantity: existingOpenItem.quantity + quantity,
          store: store || existingOpenItem.store,
          note: note || existingOpenItem.note
        }
      });
      return NextResponse.json({ ok: true, item, merged: true });
    }

    const item = await prisma.shoppingItem.create({
      data: {
        inventoryItemId,
        name,
        quantity,
        unit,
        status: "todo",
        store: store || null,
        note: note || null
      }
    });

    return NextResponse.json({ ok: true, item, merged: false });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
