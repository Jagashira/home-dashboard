import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SourceBadge } from "@/components/news/source-badge";
import { SummaryBlock } from "@/components/news/summary-block";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { getArticleById } from "@/lib/repositories/articles";

type Params = { params: Promise<{ id: string }> };

export default async function NewsDetailPage({ params }: Params) {
  ensureNewsBootstrap();
  const { id } = await params;
  const article = getArticleById(Number(id)) as
    | {
        id: number;
        title: string;
        source_label: string;
        source_type: string;
        published_at: string | null;
        topic_name: string;
        summary: string | null;
        content: string | null;
        url: string;
      }
    | undefined;
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <Card>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
          <SourceBadge sourceType={article.source_type} sourceLabel={article.source_label} />
          <span>{article.topic_name}</span>
          <span>{article.published_at ? new Date(article.published_at).toLocaleString("ja-JP") : "-"}</span>
        </div>
        <SummaryBlock summary={article.summary} />
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {(article.content ?? "").slice(0, 500)}
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          <a href={article.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            元記事
          </a>
          <Link href="/news" className="underline">
            一覧へ戻る
          </Link>
        </div>
      </Card>
    </main>
  );
}

