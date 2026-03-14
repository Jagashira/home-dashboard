import { Card } from "@/components/ui/card";

export function NewsHeader({
  latestUpdatedAt,
  totalFetched,
  sourceCounts
}: {
  latestUpdatedAt: string | null;
  totalFetched: number;
  sourceCounts: Array<{ source_type: string; count: number }>;
}) {
  const date = new Date().toLocaleDateString("ja-JP");
  return (
    <Card className="mb-4">
      <h1 className="text-3xl font-semibold text-slate-900">ニュース</h1>
      <p className="mt-1 text-sm text-slate-600">{date}</p>
      <p className="text-sm text-slate-600">最終更新 {latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString("ja-JP") : "-"}</p>
      <p className="text-sm text-slate-600">{totalFetched}件取得</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {sourceCounts.map((row) => (
          <span key={row.source_type}>
            {row.source_type}: {row.count}
          </span>
        ))}
      </div>
    </Card>
  );
}

