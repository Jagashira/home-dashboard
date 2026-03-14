"use client";

export function SourceToggleForm({
  sources,
  onChange
}: {
  sources: Array<{ id: number; sourceName: string; sourceType: string; isActive: boolean }>;
  onChange: (next: Array<{ id: number; sourceName: string; sourceType: string; isActive: boolean }>) => void;
}) {
  return (
    <div className="space-y-2">
      {sources.map((source, index) => (
        <label key={source.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={source.isActive}
            onChange={(event) => {
              const next = [...sources];
              next[index] = { ...source, isActive: event.target.checked };
              onChange(next);
            }}
          />
          {source.sourceName} ({source.sourceType})
        </label>
      ))}
    </div>
  );
}

