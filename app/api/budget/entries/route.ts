import { NextRequest, NextResponse } from "next/server";
import { createBudgetEntry } from "@/lib/budget";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const entryType = payload.entryType === "INCOME" ? "INCOME" : "EXPENSE";
    const date = typeof payload.date === "string" ? payload.date : "";
    const amount = Number(payload.amount);
    const category = typeof payload.category === "string" ? payload.category : "";
    const paymentMethod = typeof payload.paymentMethod === "string" ? payload.paymentMethod : "";
    const storeName = typeof payload.storeName === "string" ? payload.storeName : "";

    if (!date || !Number.isFinite(amount) || amount <= 0 || !category || !paymentMethod || !storeName) {
      return NextResponse.json(
        { ok: false, error: "date/amount/category/paymentMethod/storeName are required" },
        { status: 400 }
      );
    }

    const result = await createBudgetEntry({
      entryType,
      date,
      amount,
      category,
      paymentMethod,
      storeName,
      memo: typeof payload.memo === "string" ? payload.memo : "",
      sourceAccount: typeof payload.sourceAccount === "string" ? payload.sourceAccount : ""
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
