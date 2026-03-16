"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ProviderKey = "electricity" | "gas";

const labels: Record<ProviderKey, string> = {
  electricity: "電気データを更新",
  gas: "ガスデータを更新"
};

export function ProviderRefreshButton({ provider }: { provider: ProviderKey }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const runRefresh = async () => {
    setMessage("取得を開始しました...");

    try {
      const response = await fetch(`/api/billing/refresh/${provider}`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? payload.error_message ?? "更新に失敗しました。");
        return;
      }

      const details = [
        payload.billing_month ? `${payload.billing_month}` : null,
        typeof payload.saved_count === "number" ? `請求 ${payload.saved_count}件` : null,
        typeof payload.usage_saved_count === "number" && payload.usage_saved_count > 0
          ? `使用量 ${payload.usage_saved_count}件`
          : null
      ].filter(Boolean);

      setMessage(details.length > 0 ? `更新完了: ${details.join(" / ")}` : "更新完了");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    }
  };

  return (
    <div className="billing-refresh-control">
      <button className="button-primary" type="button" onClick={runRefresh} disabled={isPending}>
        {isPending ? "更新中..." : labels[provider]}
      </button>
      {message ? <p className="meta-text billing-refresh-status">{message}</p> : null}
    </div>
  );
}
