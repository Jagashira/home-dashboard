# Home Dashboard (Local-Only)

Local-only home dashboard built with Next.js App Router + Prisma + SQLite.

## Features

- Pages
  - `/news`: RSS fetch, local search, AI summarize, favorites
  - `/budget`: expense dashboard + expense/income input
  - `/tasks`: task CRUD (todo/done, importance/fatigue/minutes/dueDate)
  - `/planner`: Google Calendar sync, fatigue total, free-time blocks, today's plan
- SQLite DB under `./data` (easy migration to SSD)
- Docker Compose support

## Tech Stack

- Node.js 20+
- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- SQLite
- rss-parser
- googleapis

## Setup (Mac / Raspberry Pi)

1. Create env and data directory

```bash
cp .env.example .env
mkdir -p data
```

2. Install deps

```bash
npm install
npm run prisma:generate
```

3. Apply DB schema

### Fresh DB (recommended)

```bash
rm -f data/app.db
npm run prisma:deploy
```

### Existing DB (if you already have News/Budget data)

Because older versions created some tables outside Prisma migrations, `prisma migrate deploy` can request baseline.
In that case, execute the new migration SQL directly:

```bash
npx prisma db execute --file prisma/migrations/20260306000100_add_calendar_and_tasks/migration.sql --schema prisma/schema.prisma
npm run prisma:generate
```

4. Start dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Environment Variables

`.env.example` now includes:

```env
DATABASE_URL="file:../data/app.db"
NEWS_FEEDS="..."
OPENAI_API="..."
OPENAI_PRICE_INPUT_PER_1M="0.4"
OPENAI_PRICE_CACHED_INPUT_PER_1M="0.1"
OPENAI_PRICE_OUTPUT_PER_1M="1.6"
OPENAI_USD_TO_JPY="150"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""
GOOGLE_REFRESH_TOKEN=""
GOOGLE_CALENDAR_ID="primary"
```

---

## Google Calendar OAuth (refresh token)

1. Create a Google Cloud project
2. Enable **Google Calendar API**
3. Create OAuth Client ID (`Web application`)
4. Set redirect URI (example: `http://localhost:3000/api/auth/google/callback`)
5. Get authorization code and exchange for refresh token

Simple way with OAuth Playground:
- Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- Gear icon: use your own OAuth credentials
- Select scope: `https://www.googleapis.com/auth/calendar.readonly`
- Authorize, then exchange code
- Copy `refresh_token` into `GOOGLE_REFRESH_TOKEN`

Set all Google envs, then planner sync API can read today events.

---

## Planner Logic

- Calendar title parsing supports:
  - `[WORK] 研究`
  - `[WORK:60] 修論` (manual fatigue override)
- Fatigue weights
  - `WORK 40`, `MEET 55`, `OUT 35`, `HOME 25`, `SPORT 70`, `REST -30`
- Free-time range: `08:00-24:00`
- Task allocation rule (simple)
  - dueDate <= today first
  - higher importance first
  - shorter minutes first
  - split across blocks when needed

---

## API

### Calendar

- `POST /api/calendar/sync`
  - Fetch today events from Google Calendar
  - Parse tag/fatigue
  - Insert if same `title + startAt` not already stored
- `GET /api/calendar/today`
  - `{ events, fatigueTotal }`

### Planner

- `GET /api/planner/free-time`
  - `{ freeBlocks }`
- `GET /api/planner/today`
  - `{ events, fatigueTotal, freeBlocks, tasksTodo, plan }`

### Tasks

- `GET /api/tasks?status=todo|done`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

---

## Quick Test Flow (required)

1. Open `/tasks`
2. Add task (e.g. title `洗濯`, minutes `30`, importance `3`, fatigue `20`)
3. Open `/planner`
4. Click **Google予定を同期**
5. Confirm
   - today events list shows
   - fatigue total updates
   - free blocks are shown
   - task is allocated in plan

---

## Docker Compose

```bash
docker compose up -d --build
docker compose logs -f app
```

App is exposed on host port `3000`.

## Security

- Local network / Tailscale only
- Do not expose directly to public internet
- `.env` is gitignored

---

## MCP News Dashboard (Tavily)

Next.js now includes:

- API: `GET /api/news?query=AI&max_results=3&days=2`
- Page: `/dashboard/news`

### Env

Create `.env.local` (or set in `.env`) with:

```env
MCP_URL=http://127.0.0.1:8000/mcp
```

(`.env.local.example` is included.)

### Run Next.js

```bash
npm run dev
```

Open:

- `http://localhost:3000/dashboard/news`

### API Example

```bash
curl "http://localhost:3000/api/news?query=AI&max_results=3&days=2"
```

### Troubleshooting (MCP server)

- If API returns `{ ok:false, error: ... }`, first verify MCP server is running:
  - `python3 -m app.mcp_http_client --output ha` (already known-good check)
- Verify `MCP_URL` points to the correct endpoint:
  - `http://127.0.0.1:8000/mcp`
- Ensure MCP server supports:
  - `initialize`
  - `notifications/initialized`
  - `tools/call` (`tavily_news`)
