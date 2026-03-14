import { NextRequest, NextResponse } from "next/server";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { setArticleHidden } from "@/lib/repositories/articles";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    ensureNewsBootstrap();
    const { id } = await params;
    const articleId = Number(id);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const payload = (await request.json()) as { isHidden?: boolean };
    const updated = setArticleHidden(articleId, Boolean(payload.isHidden));
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: articleId, isHidden: Boolean(payload.isHidden) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

