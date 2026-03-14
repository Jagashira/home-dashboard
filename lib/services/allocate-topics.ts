import { Topic } from "@/lib/types";

export function allocateTopics(topics: Topic[], totalRequested: number) {
  const active = topics.filter((topic) => topic.isActive);
  const raw = active.map((topic) => (totalRequested * topic.allocationPercent) / 100);
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

