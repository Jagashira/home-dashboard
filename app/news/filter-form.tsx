"use client";

import { useMemo, useState } from "react";

type FilterFormProps = {
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
  initialPageSize: number;
  initialScanLimit: number;
  quickKeywords: string[];
};

export function NewsFilterForm({
  initialQuery,
  initialFrom,
  initialTo,
  initialPageSize,
  initialScanLimit,
  quickKeywords
}: FilterFormProps) {
  const [query, setQuery] = useState(initialQuery);

  const quickButtons = useMemo(() => {
    return [...new Set(quickKeywords.filter(Boolean))];
  }, [quickKeywords]);

  const addKeyword = (keyword: string) => {
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.includes(keyword)) {
      return;
    }
    setQuery(tokens.length === 0 ? keyword : `${query} ${keyword}`);
  };

  return (
    <form className="panel stack-md" action="/news" method="get">
      <h3>Search</h3>

      <label className="field">
        <span>Keywords</span>
        <input
          type="text"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="半導体 AI テック"
        />
      </label>

      <div className="chip-row">
        {quickButtons.map((keyword) => (
          <button
            key={keyword}
            type="button"
            className="chip"
            onClick={() => addKeyword(keyword)}
          >
            {keyword}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <label className="field">
          <span>From</span>
          <input type="date" name="from" defaultValue={initialFrom} />
        </label>

        <label className="field">
          <span>To</span>
          <input type="date" name="to" defaultValue={initialTo} />
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Page size</span>
          <input type="number" name="pageSize" min={5} max={100} defaultValue={initialPageSize} />
        </label>

        <label className="field">
          <span>Scan limit</span>
          <input
            type="number"
            name="scanLimit"
            min={50}
            max={2000}
            defaultValue={initialScanLimit}
          />
        </label>
      </div>

      <div className="actions-row">
        <button className="button-primary" type="submit">
          Apply filters
        </button>
        <a href="/news" className="button-secondary">
          Reset
        </a>
      </div>
    </form>
  );
}
