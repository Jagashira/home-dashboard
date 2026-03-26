import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseQuantity(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const location = typeof payload.location === "string" ? payload.location.trim() : "";
    const unit = typeof payload.unit === "string" ? payload.unit.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    if (!name || !unit) {
      return NextResponse.json({ ok: false, error: "name/unit are required" }, { status: 400 });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category: category || null,
        location: location || null,
        unit,
        currentQuantity: parseQuantity(payload.currentQuantity, 0),
        minimumQuantity: parseQuantity(payload.minimumQuantity, 0),
        preferredBuyQuantity: Math.max(0.1, parseQuantity(payload.preferredBuyQuantity, 1)),
        note: note || null
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
