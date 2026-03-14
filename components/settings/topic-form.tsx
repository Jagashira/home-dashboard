"use client";

import { Input } from "@/components/ui/input";

export function TopicForm({
  topics,
  onChange
}: {
  topics: Array<{
    id?: number;
    name: string;
    query: string;
    allocationPercent: number;
    displayOrder: number;
    isActive: boolean;
  }>;
  onChange: (next: Array<any>) => void;
}) {
  return (
    <div className="space-y-2">
      {topics.map((topic, index) => (
        <div className="grid gap-2 md:grid-cols-5" key={`${topic.id ?? "new"}-${index}`}>
          <Input
            value={topic.name}
            onChange={(event) => {
              const next = [...topics];
              next[index] = { ...topic, name: event.target.value };
              onChange(next);
            }}
            placeholder="表示名"
          />
          <Input
            value={topic.query}
            onChange={(event) => {
              const next = [...topics];
              next[index] = { ...topic, query: event.target.value };
              onChange(next);
            }}
            placeholder="query"
          />
          <Input
            type="number"
            value={topic.allocationPercent}
            onChange={(event) => {
              const next = [...topics];
              next[index] = { ...topic, allocationPercent: Number(event.target.value) };
              onChange(next);
            }}
            placeholder="%"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={topic.isActive}
              onChange={(event) => {
                const next = [...topics];
                next[index] = { ...topic, isActive: event.target.checked };
                onChange(next);
              }}
            />
            Active
          </label>
        </div>
      ))}
    </div>
  );
}

