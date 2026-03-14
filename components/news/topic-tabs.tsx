import Link from "next/link";

export function TopicTabs({ topics, activeTopic }: { topics: string[]; activeTopic?: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link
        href="/news"
        className={`rounded-full border px-3 py-1 text-sm ${!activeTopic ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
      >
        すべて
      </Link>
      {topics.map((topic) => (
        <Link
          key={topic}
          href={`/news?topic=${encodeURIComponent(topic)}`}
          className={`rounded-full border px-3 py-1 text-sm ${
            activeTopic === topic ? "bg-slate-900 text-white" : "bg-white text-slate-700"
          }`}
        >
          {topic}
        </Link>
      ))}
      <Link href="/news/settings" className="rounded-full border bg-white px-3 py-1 text-sm text-slate-700">
        +追加
      </Link>
    </div>
  );
}

