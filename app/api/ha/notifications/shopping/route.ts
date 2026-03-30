import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_CONFIG } from "@/lib/config";
import { buildUriAction, isAuthorizedHomeAssistantRequest } from "@/lib/ha";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedHomeAssistantRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.shoppingItem.findMany({
      where: { status: "todo" },
      orderBy: [{ createdAt: "desc" }],
      take: 5
    });

    const shoppingCount = await prisma.shoppingItem.count({
      where: { status: "todo" }
    });

    const topItems = items.map((item) => `${item.name} x${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}${item.unit}`);
    const shouldNotify = shoppingCount > 0;
    const message =
      shoppingCount > 0
        ? `未購入の買い物が ${shoppingCount} 件あります。\n${topItems.slice(0, 3).join("\n")}`
        : "未購入の買い物はありません。";

    return NextResponse.json({
      ok: true,
      shouldNotify,
      summary: {
        shoppingCount,
        topItems
      },
      notification: {
        title: "買い物メモ",
        message,
        data: {
          tag: "shopping-mode",
          group: "shopping-mode",
          url: APP_CONFIG.haShopUri,
          actions: [buildUriAction("Shop を開く", APP_CONFIG.haShopUri)],
          push: {
            interruptionLevel: "active"
          }
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
