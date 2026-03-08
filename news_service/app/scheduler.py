from __future__ import annotations

from .config import Settings
from .db import Database
from .service import NewsService
from .summarizer import Summarizer
from .tavily_client import TavilyClient


def run_once() -> dict:
    settings = Settings.from_env()
    db = Database(settings.db_path)
    db.initialize(total_requested=settings.default_total_requested, days=settings.default_days)
    service = NewsService(
        db=db,
        tavily=TavilyClient(settings.tavily_api_key),
        summarizer=Summarizer(settings.openai_api_key, settings.openai_model),
    )
    return service.fetch_news()


if __name__ == "__main__":
    result = run_once()
    print(result)

