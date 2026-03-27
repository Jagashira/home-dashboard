# News Aggregator (home-server)

4つのニュースソース（RSS / GDELT / Hacker News / NewsAPI）を統合し、本文を日本語3行要約して表示する Next.js アプリです。  
日本語記事を優先しつつ、不足時は英語記事を補完します。Raspberry Pi (ARM) での常用を想定した軽量構成です。

## 技術スタック

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- SQLite (`better-sqlite3`)
- OpenAI Responses API (`gpt-4.1-mini`) for summary only
- RSS parser (`rss-parser`)

## ディレクトリ構成

```text
app/
  news/
    page.tsx
    [id]/page.tsx
    settings/page.tsx
  api/
    news/route.ts
    news/[id]/route.ts
    news/settings/route.ts
    fetch/route.ts
components/
  ui/
  news/
  settings/
lib/
  config.ts
  db.ts
  schema.ts
  types.ts
  news-bootstrap.ts
  clients/
  repositories/
  services/
  utils/
scripts/
  init-db.ts
  seed.ts
  refresh-news.ts
```

## セットアップ

```bash
cp .env.example .env
mkdir -p data
npm install
npm run db:init
npm run db:seed
```

## .env 設定

`.env.example`:

```env
OPENAI_API_KEY=
OPENAI_ADMIN_API_KEY=
NEWS_API_KEY=
DATABASE_URL=file:/data/news/news.db
APP_BASE_URL=http://localhost:3000
FETCH_SECRET=
OPENAI_API=
STORAGE_BASE_PATH=./data/storage-dev
```

- `NEWS_API_KEY` が未設定でも動作します（NewsAPIソースは自動スキップ）。
- `OPENAI_API_KEY` 未設定時は、簡易フォールバック要約を保存します（summary空保存はしません）。
- GPT 使用量のホーム表示は `OPENAI_ADMIN_API_KEY` だけで取得します。表示するのは「今日の使用料金」「今月の使用料金」「token数」です。
- `STORAGE_BASE_PATH` は `/storage` ページが読むベースディレクトリです。Mac 開発では `./data/storage-dev` のようなローカルディレクトリ、home-server では NAS 側の実パスを設定してください。

## 開発環境起動

```bash
npm run dev
```

- 一覧: `http://localhost:3000/news`
- 設定: `http://localhost:3000/news/settings`
- ストレージ: `http://localhost:3000/storage`

## Storage ページの設定

- Mac 開発時は `STORAGE_BASE_PATH=./data/storage-dev` のように設定し、必要なら `mkdir -p data/storage-dev` で開発用ディレクトリを作成します。
- home-server では `STORAGE_BASE_PATH=/srv/home-data/storage` のように設定して起動します。
- `STORAGE_BASE_PATH` が未設定、または対象ディレクトリが存在しない場合でも `/storage` ページは落ちず、画面上に状態を表示します。

## Docker 起動

```bash
docker compose up -d --build
docker compose logs -f app
```

- コンテナ名: `news-aggregator`
- 公開ポート: `3000`
- DB永続化: 親プロジェクトの `data/news/news.db` をコンテナ内 `/data/news/news.db` として利用

## DB初期化

```bash
npm run db:init
```

## seed 実行

```bash
npm run db:seed
```

初期 topic:
- 半導体 (`半導体 日本 最新`) 34%
- AI (`AI 日本 最新`) 33%
- テック (`テック 日本 最新`) 33%

初期 source:
- RSS
- GDELT
- Hacker News
- NewsAPI

## cron から /api/fetch を叩く例

毎朝8時:

```cron
0 8 * * * curl -X POST "http://127.0.0.1:3000/api/fetch?secret=YOUR_FETCH_SECRET" >/tmp/news-fetch.log 2>&1
```

`FETCH_SECRET` を設定した場合は `x-fetch-secret` ヘッダまたは `?secret=` が必須です。

## 各ニュースソースの役割

- RSS: 日本語一次ソース中心（安定運用の土台）
- GDELT: 海外新着探索（リアルタイム補完）
- Hacker News: AI/テック話題性補強（score利用）
- NewsAPI: 補助ソース（無料版24時間遅延前提）

## API一覧

- `GET /api/news?topic=&sourceType=&date=&limit=`
- `GET /api/news/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/fetch`

## 収集ロジック概要

1. `topics` から有効topicと配分を取得
2. 合計30件になるよう配分
3. 各ソースから取得し共通型へ正規化
4. URL重複除去
5. 日本語優先ソート
6. 本文不足時はURL先本文を取得
7. OpenAIで日本語3行要約
8. `articles` 保存、`fetch_runs` 更新

## Raspberry Pi 運用時の注意点

- Node 20 LTS を使用
- swap不足時は build が落ちるため、必要なら swap を増やす
- `npm run dev` より本番は `npm run build && npm run start` 推奨
- cron は同時実行を避ける（例: 1日1回）
- `.db` は SSD 側へ移すと寿命と性能が安定

## 今後の拡張案

- 記事本文抽出の精度改善（Readability系）
- ソースごとの重み設定
- 要約キャッシュの再利用
- 既読/お気に入り管理
- 週次ダイジェスト生成
