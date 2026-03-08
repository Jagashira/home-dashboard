from __future__ import annotations

import math
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from .db import Database, now_iso
from .summarizer import Summarizer
from .tavily_client import TavilyClient


def _is_japanese_text(text: str) -> bool:
    for ch in text:
        if ("\u3040" <= ch <= "\u30ff") or ("\u4e00" <= ch <= "\u9faf"):
            return True
    return False


def _to_iso(value: str | None) -> str | None:
    if not value:
        return None
    parsed = value.strip()
    if not parsed:
        return None
    # Keep remote value as-is if parse fails.
    try:
        if parsed.endswith("Z"):
            parsed = parsed.replace("Z", "+00:00")
        return datetime.fromisoformat(parsed).astimezone(timezone.utc).isoformat()
    except ValueError:
        return value


@dataclass(frozen=True)
class AllocationRow:
    topic_id: int
    topic_name: str
    topic_query: str
    allocation_percent: int
    display_order: int


class NewsService:
    def __init__(self, db: Database, tavily: TavilyClient, summarizer: Summarizer):
        self.db = db
        self.tavily = tavily
        self.summarizer = summarizer

    def get_settings(self) -> dict[str, Any]:
        settings = self.db.fetch_one("SELECT total_requested, days, updated_at FROM app_settings WHERE id = 1")
        topic_rows = self.db.fetch_all(
            """
            SELECT t.id, t.name, t.query, t.is_active, a.allocation_percent, a.display_order
            FROM topics t
            JOIN topic_allocations a ON a.topic_id = t.id
            ORDER BY a.display_order ASC, t.id ASC
            """
        )
        topics = [
            {
                "id": row["id"],
                "name": row["name"],
                "query": row["query"],
                "is_active": bool(row["is_active"]),
                "allocation_percent": row["allocation_percent"],
                "display_order": row["display_order"],
            }
            for row in topic_rows
        ]
        return {
            "total_requested": settings["total_requested"] if settings else 30,
            "days": settings["days"] if settings else 1,
            "updated_at": settings["updated_at"] if settings else now_iso(),
            "topics": topics,
        }

    def update_settings(
        self,
        total_requested: int,
        days: int,
        topics: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if total_requested <= 0 or total_requested > 200:
            raise ValueError("total_requested must be between 1 and 200")
        if days <= 0 or days > 30:
            raise ValueError("days must be between 1 and 30")

        ts = now_iso()
        with self.db.tx() as conn:
            conn.execute(
                """
                UPDATE app_settings SET total_requested=?, days=?, updated_at=?
                WHERE id = 1
                """,
                (total_requested, days, ts),
            )

            for topic in topics:
                topic_id = int(topic.get("id", 0))
                name = str(topic.get("name", "")).strip()
                query = str(topic.get("query", "")).strip()
                is_active = 1 if bool(topic.get("is_active", True)) else 0
                allocation = int(topic.get("allocation_percent", 0))
                display_order = int(topic.get("display_order", 0))
                if not name or not query:
                    continue

                if topic_id > 0:
                    conn.execute(
                        """
                        UPDATE topics SET name=?, query=?, is_active=?, updated_at=?
                        WHERE id=?
                        """,
                        (name, query, is_active, ts, topic_id),
                    )
                    conn.execute(
                        """
                        UPDATE topic_allocations SET allocation_percent=?, display_order=?, updated_at=?
                        WHERE topic_id=?
                        """,
                        (allocation, display_order, ts, topic_id),
                    )
                else:
                    cur = conn.execute(
                        """
                        INSERT INTO topics(name, query, is_active, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (name, query, is_active, ts, ts),
                    )
                    new_id = cur.lastrowid
                    conn.execute(
                        """
                        INSERT INTO topic_allocations(topic_id, allocation_percent, display_order, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (new_id, allocation, display_order, ts, ts),
                    )

        return self.get_settings()

    def list_articles(self, topic: str | None = None) -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ""
        if topic:
            where = "WHERE t.name = ?"
            params.append(topic)
        rows = self.db.fetch_all(
            f"""
            SELECT
              a.id, a.title, a.url, a.source, a.published_at, a.fetched_at,
              a.summary, a.language, a.is_japanese, t.name AS topic_name
            FROM articles a
            JOIN topics t ON t.id = a.topic_id
            {where}
            ORDER BY a.is_japanese DESC, a.published_at DESC, a.id DESC
            """,
            tuple(params),
        )
        return [dict(row) for row in rows]

    def get_article(self, article_id: int) -> dict[str, Any] | None:
        row = self.db.fetch_one(
            """
            SELECT
              a.id, a.title, a.url, a.source, a.published_at, a.fetched_at, a.content,
              a.summary, a.language, a.is_japanese, t.name AS topic_name
            FROM articles a
            JOIN topics t ON t.id = a.topic_id
            WHERE a.id=?
            """,
            (article_id,),
        )
        return dict(row) if row else None

    def fetch_news(self) -> dict[str, Any]:
        settings = self.get_settings()
        total_requested = int(settings["total_requested"])
        days = int(settings["days"])
        allocations = self._active_allocations()
        if not allocations:
            raise ValueError("No active topics found.")

        started_at = now_iso()
        fetch_run_id = self._create_fetch_run(total_requested, days, started_at)
        inserted = 0
        fetched = 0

        try:
            per_topic = self._allocate_counts(total_requested, allocations)
            with self.db.tx() as conn:
                for row, count in zip(allocations, per_topic):
                    query = f"{row.topic_query} 日本語"
                    docs = self.tavily.news(query=query, max_results=count, days=days)
                    fetched += len(docs)
                    for doc in docs:
                        if not doc.url:
                            continue
                        if self._exists_url(conn, doc.url):
                            continue
                        text = doc.content or ""
                        japanese = _is_japanese_text(f"{doc.title}\n{text}")
                        language = "ja" if japanese else "en"
                        summary = self.summarizer.summarize(doc.title, text)
                        ts = now_iso()
                        conn.execute(
                            """
                            INSERT INTO articles(
                              topic_id, fetch_run_id, title, url, source, published_at, fetched_at, content,
                              summary, language, is_japanese, created_at, updated_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                row.topic_id,
                                fetch_run_id,
                                doc.title or "(untitled)",
                                doc.url,
                                doc.source,
                                _to_iso(doc.published_date),
                                ts,
                                text,
                                summary,
                                language,
                                1 if japanese else 0,
                                ts,
                                ts,
                            ),
                        )
                        inserted += 1

            self._finish_fetch_run(fetch_run_id, fetched, "success", None)
            return {
                "status": "success",
                "fetch_run_id": fetch_run_id,
                "total_requested": total_requested,
                "total_fetched": fetched,
                "new_articles": inserted,
                "started_at": started_at,
                "finished_at": now_iso(),
            }
        except Exception as exc:  # noqa: BLE001
            self._finish_fetch_run(fetch_run_id, fetched, "failed", str(exc))
            raise

    def _active_allocations(self) -> list[AllocationRow]:
        rows = self.db.fetch_all(
            """
            SELECT t.id AS topic_id, t.name AS topic_name, t.query AS topic_query,
                   a.allocation_percent, a.display_order
            FROM topics t
            JOIN topic_allocations a ON a.topic_id = t.id
            WHERE t.is_active = 1
            ORDER BY a.display_order ASC, t.id ASC
            """
        )
        return [
            AllocationRow(
                topic_id=row["topic_id"],
                topic_name=row["topic_name"],
                topic_query=row["topic_query"],
                allocation_percent=int(row["allocation_percent"]),
                display_order=int(row["display_order"]),
            )
            for row in rows
        ]

    @staticmethod
    def _allocate_counts(total: int, rows: list[AllocationRow]) -> list[int]:
        raw = [(total * row.allocation_percent) / 100.0 for row in rows]
        base = [math.floor(v) for v in raw]
        remainder = total - sum(base)
        fractions = sorted(
            [(raw[i] - base[i], i) for i in range(len(rows))],
            key=lambda x: x[0],
            reverse=True,
        )
        for _, idx in fractions[:remainder]:
            base[idx] += 1
        return [max(1, n) for n in base]

    @staticmethod
    def _exists_url(conn: sqlite3.Connection, url: str) -> bool:
        row = conn.execute("SELECT 1 FROM articles WHERE url=? LIMIT 1", (url,)).fetchone()
        return row is not None

    def _create_fetch_run(self, total_requested: int, days: int, started_at: str) -> int:
        with self.db.tx() as conn:
            cur = conn.execute(
                """
                INSERT INTO fetch_runs(run_date, days, total_requested, total_fetched, status, error_message, started_at, finished_at)
                VALUES (?, ?, ?, 0, 'running', NULL, ?, NULL)
                """,
                (date.today().isoformat(), days, total_requested, started_at),
            )
            return int(cur.lastrowid)

    def _finish_fetch_run(
        self,
        fetch_run_id: int,
        total_fetched: int,
        status: str,
        error_message: str | None,
    ) -> None:
        with self.db.tx() as conn:
            conn.execute(
                """
                UPDATE fetch_runs
                SET total_fetched=?, status=?, error_message=?, finished_at=?
                WHERE id=?
                """,
                (total_fetched, status, error_message, now_iso(), fetch_run_id),
            )

