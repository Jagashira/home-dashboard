"use client";

import { Input } from "@/components/ui/input";

export function AllocationForm({
  totalRequested,
  days,
  preferJapanese,
  onChange
}: {
  totalRequested: number;
  days: number;
  preferJapanese: boolean;
  onChange: (next: { totalRequested: number; days: number; preferJapanese: boolean }) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm">
        総取得件数
        <Input
          type="number"
          value={totalRequested}
          min={1}
          max={200}
          onChange={(event) =>
            onChange({
              totalRequested: Number(event.target.value),
              days,
              preferJapanese
            })
          }
        />
      </label>
      <label className="text-sm">
        取得範囲 days
        <Input
          type="number"
          value={days}
          min={1}
          max={7}
          onChange={(event) =>
            onChange({
              totalRequested,
              days: Number(event.target.value),
              preferJapanese
            })
          }
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={preferJapanese}
          onChange={(event) =>
            onChange({
              totalRequested,
              days,
              preferJapanese: event.target.checked
            })
          }
        />
        日本語優先
      </label>
    </div>
  );
}

