# News Collector Dashboard (FastAPI)

Tavily API でニュース収集し、OpenAI (`gpt-4.1-mini`) で日本語3行要約して表示する軽量ダッシュボードです。

## 1. セットアップ

```bash
cd news_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
mkdir -p data
```

`.env` に API キーを設定してください。

## 2. 起動

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

画面:

- `http://localhost:8080/news`
- `http://localhost:8080/news/settings`

## 3. API

- `GET /api/news`
- `GET /api/news?topic=AI`
- `GET /api/news/settings`
- `PUT /api/news/settings`
- `POST /api/news/fetch`
- `GET /api/news/articles/{id}`

### curl examples

```bash
curl "http://localhost:8080/api/news"
curl "http://localhost:8080/api/news?topic=AI"
curl -X POST "http://localhost:8080/api/news/fetch"
```

## 4. スケジューラ (cron)

手動実行:

```bash
source .venv/bin/activate
python -m app.scheduler
```

cron 設定例（毎日 08:00）:

```cron
0 8 * * * /path/to/home-dashboard/news_service/scripts/cron_fetch.sh
```

## 5. DB schema

`app/db.py` に下記テーブルを定義:

- `topics`
- `topic_allocations`
- `fetch_runs`
- `articles`
- `app_settings`

`articles.url` は `UNIQUE`、索引は `topic_id`, `published_at`, `is_japanese` を作成。

## 6. 実装メモ

- 1日 30件（設定変更可）
- topic=`news`, days=`1`（設定変更可）
- 割合配分でトピックごとに取得件数を決定
- URL重複は DB UNIQUE で除外
- 表示順: `is_japanese DESC, published_at DESC`

