# Home Dashboard (Local-Only)

MVP home dashboard built with Next.js App Router, Prisma, and SQLite.

## Features

- Next.js App Router pages: `/`, `/news`, `/shop`, `/budget`
- Prisma + SQLite with DB file in `./data`
- RSS ingestion flow for `/news`
- `POST /api/news/refresh` to fetch and store latest feed items
- Dedup based on `sha256(url + title)`
- Docker Compose support for Raspberry Pi 4 (Ubuntu) and Mac

## Tech Stack

- Node.js 20+
- Next.js 15
- Prisma ORM
- SQLite
- `rss-parser`

## Local Development (Mac or Raspberry Pi)

1. Install prerequisites:
- Node.js 20+
- npm

2. Configure environment:

```bash
cp .env.example .env
mkdir -p data
```

3. Install dependencies and generate Prisma client:

```bash
npm install
npm run prisma:generate
```

4. Apply migration:

```bash
npm run prisma:deploy
```

5. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## News Feed Setup

Update `.env`:

```env
DATABASE_URL="file:../data/app.db"
NEWS_FEEDS="https://hnrss.org/frontpage,https://feeds.bbci.co.uk/news/rss.xml"
```

Refresh news items:

- From UI: visit `/news` and click **Refresh News**
- From CLI:

```bash
npm run news:refresh
```

## Docker Compose (Production, Local Network)

1. Ensure `.env` exists (copy from `.env.example` if needed).
2. Start app:

```bash
docker compose up -d --build
```

3. View logs:

```bash
docker compose logs -f app
```

App is exposed on port `3000` of the host.

## Raspberry Pi 4 Notes

- Use 64-bit Ubuntu on Raspberry Pi for best compatibility.
- Docker image uses `node:20-bookworm-slim` (multi-arch).
- Keep persistent DB on mounted `./data` (good target for SSD migration later).

## Security Notes (Local-Only)

- Do not publish ports to the internet directly.
- Access over LAN or Tailscale only.
- Keep `.env` out of git (already ignored).

## Project Structure

- `app/`: Next.js App Router pages and API routes
- `lib/news.ts`: RSS parsing and dedup insertion logic
- `prisma/schema.prisma`: Prisma schema
- `prisma/migrations/`: SQL migration files
- `data/`: SQLite database location

## API

### `POST /api/news/refresh`

Fetches RSS feeds from `NEWS_FEEDS`, stores new items, updates existing matching dedup hash.

Example response:

```json
{
  "ok": true,
  "inserted": 12,
  "totalFetched": 28,
  "refreshedAt": "2026-03-05T01:23:45.678Z"
}
```

## Migration Included

Initial migration creates `NewsItem` table with unique `dedupHash` index.
