import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function sortInventoryByNeed<
  T extends {
    name: string;
    currentQuantity: number;
    minimumQuantity: number;
  }
>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftGap = left.currentQuantity - left.minimumQuantity;
    const rightGap = right.currentQuantity - right.minimumQuantity;

    if (leftGap !== rightGap) return leftGap - rightGap;
    return left.name.localeCompare(right.name, "ja");
  });
}

export async function GET() {
  try {
    const [inventoryItems, shoppingItems] = await Promise.all([
      prisma.inventoryItem.findMany({
        orderBy: [{ name: "asc" }]
      }),
      prisma.shoppingItem.findMany({
        include: {
          inventoryItem: true
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }]
      })
    ]);

    const shortages = sortInventoryByNeed(
      inventoryItems.filter((item) => item.currentQuantity <= item.minimumQuantity)
    );
    const openItems = shoppingItems.filter((item) => item.status === "todo");
    const purchasedItems = shoppingItems.filter((item) => item.status === "done");

    return NextResponse.json({
      ok: true,
      inventoryItems,
      shortages,
      shoppingItems: openItems,
      purchasedItems,
      summary: {
        inventoryCount: inventoryItems.length,
        shortageCount: shortages.length,
        shoppingCount: openItems.length,
        purchasedCount: purchasedItems.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
