import { NextRequest, NextResponse } from "next/server";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { setArticleFavorite } from "@/lib/repositories/articles";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    ensureNewsBootstrap();
    const { id } = await params;
    const articleId = Number(id);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const payload = (await request.json()) as { isFavorite?: boolean };
    const updated = setArticleFavorite(articleId, Boolean(payload.isFavorite));
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: articleId, isFavorite: Boolean(payload.isFavorite) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

