import { NextRequest, NextResponse } from "next/server";
import { getArticleById } from "@/lib/repositories/articles";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    ensureNewsBootstrap();
    const { id } = await params;
    const articleId = Number(id);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const article = getArticleById(articleId);
    if (!article) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, article });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

