export function SummaryBlock({ summary }: { summary: string | null }) {
  return <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{summary ?? "要約なし"}</pre>;
}

