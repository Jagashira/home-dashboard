"use client";

import { useState } from "react";

type FavoriteButtonProps = {
  newsItemId: string;
  initialIsFavorite: boolean;
};

export function FavoriteButton({ newsItemId, initialIsFavorite }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/news/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsItemId })
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setIsFavorite(Boolean(payload.isFavorite));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={isFavorite ? "heart-button is-active" : "heart-button"}
      onClick={toggle}
      disabled={busy}
      aria-label="favorite"
      title={isFavorite ? "お気に入り解除" : "お気に入り追加"}
    >
      <span className="heart-glyph" aria-hidden="true">
        {isFavorite ? "♥" : "♡"}
      </span>
    </button>
  );
}
