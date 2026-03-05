"use client";

import { useEffect, useState } from "react";

type NewsResultMetaProps = {
  total: number;
  page: number;
  totalPages: number;
  paywallMode: string;
};

export function NewsResultMeta({ total, page, totalPages, paywallMode }: NewsResultMetaProps) {
  const [refreshStatus, setRefreshStatus] = useState<string>("");

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setRefreshStatus(custom.detail ?? "");
    };

    window.addEventListener("news-refresh-status", listener as EventListener);
    return () => {
      window.removeEventListener("news-refresh-status", listener as EventListener);
    };
  }, []);

  return (
    <div className="stack-sm result-meta-wrap">
      <p className="status-text search-result-meta">
        {total} items / {page} / {totalPages} / {paywallMode}
      </p>
      <p className={refreshStatus ? "status-text refresh-status" : "status-text refresh-status is-empty"}>
        {refreshStatus || "status"}
      </p>
    </div>
  );
}
