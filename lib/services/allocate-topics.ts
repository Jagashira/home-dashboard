import { Topic } from "@/lib/types";

export function allocateTopics(topics: Topic[], totalRequested: number) {
  const active = topics.filter((topic) => topic.isActive);
  const allocationBase =
    active.reduce((sum, topic) => sum + Math.max(0, topic.allocationPercent), 0) || active.length || 1;
  const raw = active.map(
    (topic) => (totalRequested * Math.max(0, topic.allocationPercent)) / allocationBase
  );
  const base = raw.map((v) => Math.floor(v));
  let remain = totalRequested - base.reduce((sum, v) => sum + v, 0);

  const fractions = raw
    .map((v, i) => ({ i, fraction: v - base[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const row of fractions) {
    if (remain <= 0) break;
    base[row.i] += 1;
    remain -= 1;
  }

  return active.map((topic, i) => ({
    topic,
    count: Math.max(1, base[i] || 0)
  }));
}
