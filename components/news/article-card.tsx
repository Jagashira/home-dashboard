import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "./source-badge";
import { SummaryBlock } from "./summary-block";
import { ArticleActions } from "./article-actions";

type ArticleRow = {
  id: number;
  title: string;
  url: string;
  source_label: string;
  source_type: string;
  published_at: string | null;
  topic_name: string;
  summary: string | null;
  is_favorite: number;
  is_hidden: number;
};

export function ArticleCard({ article }: { article: ArticleRow }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{article.title}</h3>
        <ArticleActions
          articleId={article.id}
          initialFavorite={article.is_favorite === 1}
          initialHidden={article.is_hidden === 1}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SourceBadge sourceType={article.source_type} sourceLabel={article.source_label} />
        <Badge>{article.topic_name}</Badge>
        <Badge>{article.published_at ? new Date(article.published_at).toLocaleString("ja-JP") : "-"}</Badge>
      </div>
      <SummaryBlock summary={article.summary} />
      <div className="mt-3 flex gap-3 text-sm">
        <a href={article.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          元記事
        </a>
        <Link href={`/news/${article.id}`} className="text-slate-700 underline">
          詳細
        </Link>
      </div>
    </Card>
  );
}
