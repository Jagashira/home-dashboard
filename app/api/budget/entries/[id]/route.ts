import { NextRequest, NextResponse } from "next/server";
import { deleteBudgetEntry, updateExpenseEntry } from "@/lib/budget";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();

    const date = typeof payload.date === "string" ? payload.date : "";
    const amount = Number(payload.amount);
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const paymentMethod = typeof payload.paymentMethod === "string" ? payload.paymentMethod.trim() : "";
    const storeName = typeof payload.storeName === "string" ? payload.storeName.trim() : "";

    if (!id || !date || !Number.isFinite(amount) || amount <= 0 || !category || !paymentMethod || !storeName) {
      return NextResponse.json(
        { ok: false, error: "id/date/amount/category/paymentMethod/storeName are required" },
        { status: 400 }
      );
    }

    const updated = await updateExpenseEntry(id, {
      date,
      amount,
      category,
      paymentMethod,
      storeName,
      memo: typeof payload.memo === "string" ? payload.memo : ""
    });

    if (updated <= 0) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const deleted = await deleteBudgetEntry(id);
    if (deleted <= 0) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
