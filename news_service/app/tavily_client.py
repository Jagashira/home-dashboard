from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


@dataclass(frozen=True)
class TavilyArticle:
    title: str
    url: str
    source: str | None
    published_date: str | None
    content: str | None


class TavilyClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def news(self, query: str, max_results: int, days: int) -> list[TavilyArticle]:
        payload = {
            "api_key": self.api_key,
            "query": query,
            "topic": "news",
            "days": days,
            "max_results": max_results,
            "include_raw_content": True,
        }
        response = requests.post(
            "https://api.tavily.com/search", json=payload, timeout=30
        )
        response.raise_for_status()
        data = response.json()
        rows = data.get("results", []) if isinstance(data, dict) else []
        items: list[TavilyArticle] = []
        for item in rows:
            if not isinstance(item, dict):
                continue
            items.append(
                TavilyArticle(
                    title=str(item.get("title") or "").strip(),
                    url=str(item.get("url") or "").strip(),
                    source=(str(item.get("source")).strip() if item.get("source") else None),
                    published_date=(
                        str(item.get("published_date")).strip()
                        if item.get("published_date")
                        else None
                    ),
                    content=(
                        str(item.get("raw_content") or item.get("content") or "").strip()
                        or None
                    ),
                )
            )
        return items

