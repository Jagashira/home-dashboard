import Link from "next/link";
import { ArticleCard } from "@/components/news/article-card";
import { Card } from "@/components/ui/card";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { listArticles } from "@/lib/repositories/articles";

export const dynamic = "force-dynamic";

export default function FavoritesPage() {
  ensureNewsBootstrap();
  const items = listArticles({ onlyFavorite: true, includeHidden: true, limit: 300 });

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      <Card>
        <h1 className="text-2xl font-semibold">お気に入り</h1>
        <p className="mt-1 text-sm text-slate-600">{items.length} 件</p>
        <div className="mt-3">
          <Link href="/news" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            ニュースへ戻る
          </Link>
        </div>
      </Card>
      <section className="space-y-3">
        {items.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {items.length === 0 ? (
          <Card>
            <p className="text-sm">ハートを押した記事がここに表示されます。</p>
          </Card>
        ) : null}
      </section>
    </main>
  );
}

