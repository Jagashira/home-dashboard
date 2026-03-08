from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from .config import Settings
from .db import Database
from .service import NewsService
from .summarizer import Summarizer
from .tavily_client import TavilyClient


class TopicSetting(BaseModel):
    id: int | None = None
    name: str = Field(min_length=1)
    query: str = Field(min_length=1)
    is_active: bool = True
    allocation_percent: int = Field(ge=0, le=100)
    display_order: int = Field(ge=0)


class SettingsUpdateRequest(BaseModel):
    total_requested: int = Field(ge=1, le=200)
    days: int = Field(ge=1, le=30)
    topics: list[TopicSetting]


settings = Settings.from_env()
db = Database(settings.db_path)
db.initialize(total_requested=settings.default_total_requested, days=settings.default_days)
service = NewsService(
    db=db,
    tavily=TavilyClient(settings.tavily_api_key),
    summarizer=Summarizer(settings.openai_api_key, settings.openai_model),
)

app = FastAPI(title="News Collector Dashboard", version="1.0.0")
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))
app.mount(
    "/static",
    StaticFiles(directory=str(Path(__file__).resolve().parent / "static")),
    name="static",
)


@app.get("/api/news")
def api_news(topic: str | None = Query(default=None)) -> dict[str, Any]:
    rows = service.list_articles(topic=topic)
    return {
        "items": rows,
        "count": len(rows),
    }


@app.get("/api/news/settings")
def api_news_settings() -> dict[str, Any]:
    return service.get_settings()


@app.put("/api/news/settings")
def api_news_settings_put(payload: SettingsUpdateRequest) -> dict[str, Any]:
    try:
        return service.update_settings(
            total_requested=payload.total_requested,
            days=payload.days,
            topics=[item.model_dump() for item in payload.topics],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/news/fetch")
def api_news_fetch() -> dict[str, Any]:
    try:
        return service.fetch_news()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/news/articles/{article_id}")
def api_news_article(article_id: int) -> dict[str, Any]:
    row = service.get_article(article_id)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    return row


@app.get("/news", response_class=HTMLResponse)
def page_news(request: Request, topic: str | None = Query(default=None)) -> HTMLResponse:
    items = service.list_articles(topic=topic)
    settings_data = service.get_settings()
    topics = [{"name": "すべて"}] + [{"name": t["name"]} for t in settings_data["topics"]]
    now = datetime.now().strftime("%Y-%m-%d")
    return templates.TemplateResponse(
        request,
        "news.html",
        {
            "items": items,
            "topic": topic or "すべて",
            "topics": topics,
            "today": now,
            "total_requested": settings_data["total_requested"],
            "updated_at": settings_data["updated_at"],
        },
    )


@app.get("/news/settings", response_class=HTMLResponse)
def page_news_settings(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "settings.html",
        {
            "settings": service.get_settings(),
        },
    )


@app.get("/")
def root() -> dict[str, str]:
    return {"ok": "true", "message": "Open /news"}

