# Organizer Task / Planner

新しい個人用予定・タスク管理基盤です。旧 `Task` / `CalendarEvent` テーブルと旧 API は残したまま、`Organizer*` テーブルと `/api/organizer/*` を追加しています。旧データの移行は行いません。

## 画面

- `/tasks`: Task の作成、編集、完了・完了解除、キャンセル、削除、日付・状態・カテゴリによる絞り込み、並び替え
- `/planner`: 指定日の Event と TimeBlock を同じ時間軸に表示。空き時間から Event を作成し、未割当 Task から TimeBlock を作成できます。
- 画面右上の `Add` は Task / Event 共通の高速入力です。Task の「やりたい日」と「本当の締切」は新規作成時に Asia/Tokyo の今日を初期値にします。
- Desktop では未割当 Task を時間軸へドラッグできます。クリックまたはタップして開始時刻を指定する操作を常に利用できます。
- Mobile では `未割当` ボタンから drawer を開きます。

## データモデル

### OrganizerTask

`title`, `description`, `category`, `status`, `importance`, `estimatedMinutes`, `targetDate`, `dueDate`, `createdAt`, `updatedAt`, `completedAt`

`targetDate` と `dueDate` は `YYYY-MM-DD` の date-only 値です。UTC の瞬間へ変換しません。

### OrganizerEvent

`title`, `description`, `category`, `startAt`, `endAt`, `allDay`, `location`, `shareWithPartner`, `googleCalendarEventId`, `timetreeEventId`, `timetreeSyncStatus`, `createdAt`, `updatedAt`

`shareWithPartner` の既定値は `false` です。カテゴリから自動設定しません。

### OrganizerTimeBlock

`taskId`, `title`, `startAt`, `endAt`, `status`, `actualStartAt`, `actualEndAt`, `createdAt`, `updatedAt`

Task と TimeBlock は 1:N です。Task を削除すると、その Task の TimeBlock だけが cascade delete されます。

### OrganizerRoutine / OrganizerRoutineCompletion

Routine は `title`, `category`, `estimatedMinutes`, `daysOfWeek`, `active` を持ちます。RoutineCompletion は Routine と date-only の `date` を一意な組として実績を保存します。今回は CRUD API のみです。

`startAt` / `endAt` / 実績時刻は UTC の instant としてDBへ保存し、画面では Asia/Tokyo へ変換します。

## API

| Method | Path | 用途 |
| --- | --- | --- |
| GET, POST | `/api/organizer/tasks` | Task 一覧・作成 |
| GET, PATCH, DELETE | `/api/organizer/tasks/:id` | Task 詳細・更新・削除 |
| GET | `/api/organizer/tasks/unscheduled` | 有効な TimeBlock がない未完了 Task |
| GET, POST | `/api/organizer/events` | Event の期間検索・作成 |
| GET, PATCH, DELETE | `/api/organizer/events/:id` | Event 詳細・更新・削除 |
| GET, POST | `/api/organizer/time-blocks` | TimeBlock の期間検索・作成 |
| GET, PATCH, DELETE | `/api/organizer/time-blocks/:id` | TimeBlock 詳細・更新・削除 |
| GET | `/api/organizer/planner?date=YYYY-MM-DD` | 指定日の Event / TimeBlock / 未割当 Task |
| GET, POST | `/api/organizer/routines` | Routine 一覧・作成 |
| GET, PATCH, DELETE | `/api/organizer/routines/:id` | Routine 詳細・更新・削除 |
| GET, POST | `/api/organizer/routine-completions` | Routine 実績一覧・作成 |
| GET, PATCH, DELETE | `/api/organizer/routine-completions/:id` | Routine 実績詳細・更新・削除 |

API はカテゴリ、status、importance、正の見積時間、曜日、boolean、date-only、`endAt > startAt` を検証します。UI は API の日本語エラーメッセージを表示します。

## ローカル実行

```bash
cd apps/home-dashboard
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm dev
```

検証:

```bash
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm build
```

## Home Server へ反映

```bash
cd /home/home-server/home-platform
git pull
docker compose build home-dashboard
docker compose up -d home-dashboard
docker compose logs -f home-dashboard
```

既存の Compose 構成と `./data:/data` volume をそのまま使います。`home-dashboard` の起動時コマンドに含まれる `prisma migrate deploy` が新規テーブルを追加します。Compose ファイルの変更や新規サービスはありません。

反映前に `data/news/news.db` をバックアップしてください。反映後は `/tasks` と `/planner` を開き、Task → 未割当 Task → TimeBlock と Event の作成・編集を確認します。

## Rollback

アプリコードは対象変更を `git revert` してから `home-dashboard` を再build・再起動します。migration は旧テーブルや旧データを変更しないため、Organizer テーブルは残しても旧画面/APIの動作に影響しません。

Organizer テーブルを削除する rollback migration は用意していません。運用データを消す処理になるためです。完全削除が必要な場合はDBをバックアップし、データ保持方針を確認してから別migrationとして実施してください。

## 将来連携の接続点

- Google Calendar: `OrganizerEvent.googleCalendarEventId`
- TimeTree: `shareWithPartner`, `timetreeEventId`, `timetreeSyncStatus`
- Daily / Weekly Planning: date-only の Task 日付、Routine、Planner日次集約、Task 1:N TimeBlock
- Home Assistant: `/api/organizer/planner` を元にした今日の read model を追加可能

Google Calendar / TimeTree への実同期、同期queue、Home Assistant変更、AI提案は今回の実装範囲に含みません。
