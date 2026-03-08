from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    tavily_api_key: str
    openai_api_key: str
    openai_model: str
    db_path: Path
    default_total_requested: int
    default_days: int
    host: str
    port: int

    @classmethod
    def from_env(cls) -> "Settings":
        root = Path(__file__).resolve().parents[1]
        data_dir = root.parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)

        tavily_api_key = os.getenv("TAVILY_API_KEY", "").strip()
        openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not tavily_api_key:
            raise RuntimeError("TAVILY_API_KEY is required.")
        if not openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required.")

        return cls(
            tavily_api_key=tavily_api_key,
            openai_api_key=openai_api_key,
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip(),
            db_path=Path(os.getenv("NEWS_DB_PATH", str(data_dir / "news.db"))),
            default_total_requested=int(os.getenv("NEWS_TOTAL_REQUESTED", "30")),
            default_days=int(os.getenv("NEWS_DAYS", "1")),
            host=os.getenv("NEWS_HOST", "0.0.0.0"),
            port=int(os.getenv("NEWS_PORT", "8080")),
        )

