"use client";

import { useState } from "react";

export function ArticleActions({
  articleId,
  initialFavorite,
  initialHidden
}: {
  articleId: number;
  initialFavorite: boolean;
  initialHidden: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [hidden, setHidden] = useState(initialHidden);
  const [busy, setBusy] = useState(false);

  const toggleFavorite = async () => {
    setBusy(true);
    try {
      const next = !favorite;
      const res = await fetch(`/api/news/${articleId}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next })
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setFavorite(next);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = async () => {
    setBusy(true);
    try {
      const next = !hidden;
      const res = await fetch(`/api/news/${articleId}/hidden`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: next })
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setHidden(next);
      }
    } finally {
      setBusy(false);
      location.reload();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={toggleFavorite}
        className={`rounded-lg border px-2 py-1 text-sm ${favorite ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-300 bg-white text-slate-600"}`}
        title={favorite ? "お気に入り解除" : "お気に入り追加"}
      >
        {favorite ? "♥" : "♡"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={toggleHidden}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600"
      >
        {hidden ? "非表示解除" : "非表示"}
      </button>
    </div>
  );
}

