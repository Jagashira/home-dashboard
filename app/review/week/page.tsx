import Link from "next/link";
import { getWeeklyReview } from "@/lib/weekly-review";

export const dynamic = "force-dynamic";

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function WeeklyReviewPage() {
  const review = await getWeeklyReview();

  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-md">
          <div className="stack-sm">
            <p className="label-caption">WEEKLY REVIEW</p>
            <h1 className="budget-title">今週の振り返り</h1>
            <p className="status-text">
              {review.week.label} の支出、task、ニュース、Immich をまとめています。
            </p>
          </div>
          <div className="actions-row">
            <Link className="button-primary" href="/">
              ホームへ戻る
            </Link>
            <Link className="button-secondary" href="/tasks">
              Tasks を開く
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {review.highlights.map((item) => (
          <article className="panel" key={item.label}>
            <p className="label-caption">{item.label}</p>
            <h3 className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <p className="label-caption">SUMMARY</p>
        <p className="mt-3 text-base leading-7 text-slate-700">{review.reviewText}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="panel">
          <p className="label-caption">Budget</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{formatYen(review.budget.total)}</h2>
          <p className="mt-2 text-sm text-slate-600">
            先週 {formatYen(review.budget.previousTotal)}
            {review.budget.deltaPercent === null ? " / 比較データなし" : ` / 先週比 ${review.budget.deltaPercent > 0 ? "+" : ""}${review.budget.deltaPercent}%`}
          </p>
          <div className="mt-4 space-y-2">
            {review.budget.topCategories.map((item) => (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3" key={item.label}>
                <span className="text-sm text-slate-700">{item.label}</span>
                <strong className="text-sm text-slate-900">{formatYen(item.value)}</strong>
              </div>
            ))}
            {review.budget.topCategories.length === 0 ? <p className="text-sm text-slate-500">今週の支出はまだありません。</p> : null}
          </div>
        </article>

        <article className="panel">
          <p className="label-caption">Tasks</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{review.tasks.completedCount} 件完了</h2>
          <p className="mt-2 text-sm text-slate-600">
            追加 {review.tasks.addedCount} 件 / 持ち越し {review.tasks.carryOverCount} 件
          </p>
          <div className="mt-4 space-y-2">
            {review.tasks.recentCompletedTitles.map((title) => (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" key={title}>
                {title}
              </div>
            ))}
            {review.tasks.recentCompletedTitles.length === 0 ? <p className="text-sm text-slate-500">今週完了した task はまだありません。</p> : null}
          </div>
        </article>

        <article className="panel">
          <p className="label-caption">News</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{review.news.publishedCount} 件追加</h2>
          <p className="mt-2 text-sm text-slate-600">お気に入り {review.news.favoriteCount} 件</p>
          <div className="mt-4 space-y-2">
            {review.news.topTopics.map((topic) => (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3" key={topic.label}>
                <span className="text-sm text-slate-700">{topic.label}</span>
                <strong className="text-sm text-slate-900">{topic.count} 件</strong>
              </div>
            ))}
            {review.news.topTopics.length === 0 ? <p className="text-sm text-slate-500">今週のニュースはまだありません。</p> : null}
          </div>
        </article>

        <article className="panel">
          <p className="label-caption">Immich</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            写真 {review.immich.photoAddedCount} / 動画 {review.immich.videoAddedCount}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{review.immich.note}</p>
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {review.immich.available
              ? `今週は写真 ${review.immich.photoAddedCount} 枚、動画 ${review.immich.videoAddedCount} 本が追加されました。`
              : "Immich API を設定すると今週の追加量を表示できます。"}
          </div>
        </article>
      </section>
    </section>
  );
}
