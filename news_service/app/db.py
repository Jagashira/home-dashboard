from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  allocation_percent INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(topic_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS fetch_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  total_requested INTEGER NOT NULL,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  fetch_run_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  language TEXT,
  is_japanese INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(topic_id) REFERENCES topics(id),
  FOREIGN KEY(fetch_run_id) REFERENCES fetch_runs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_is_japanese ON articles(is_japanese);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_requested INTEGER NOT NULL DEFAULT 30,
  days INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def tx(self) -> Generator[sqlite3.Connection, None, None]:
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def initialize(self, total_requested: int, days: int) -> None:
        with self.tx() as conn:
            conn.executescript(SCHEMA_SQL)
            count = conn.execute("SELECT COUNT(*) AS c FROM topics").fetchone()["c"]
            if count == 0:
                ts = now_iso()
                seeds = [
                    ("半導体", "半導体", 1, ts, ts, 40, 1),
                    ("AI", "AI", 1, ts, ts, 40, 2),
                    ("テック", "テック", 1, ts, ts, 20, 3),
                ]
                for name, query, active, created, updated, alloc, order in seeds:
                    cur = conn.execute(
                        """
                        INSERT INTO topics(name, query, is_active, created_at, updated_at)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        (name, query, active, created, updated),
                    )
                    topic_id = cur.lastrowid
                    conn.execute(
                        """
                        INSERT INTO topic_allocations(topic_id, allocation_percent, display_order, created_at, updated_at)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        (topic_id, alloc, order, ts, ts),
                    )

            conn.execute(
                """
                INSERT INTO app_settings(id, total_requested, days, updated_at)
                VALUES(1, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                (total_requested, days, now_iso()),
            )

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
        with self.tx() as conn:
            return list(conn.execute(query, params).fetchall())

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
        with self.tx() as conn:
            return conn.execute(query, params).fetchone()

