# Google Calendar → Organizer 初回Import

この機能はGoogle Calendarを読み取り専用の移行元として扱います。Google Calendarへの作成・更新・削除・移動、Calendar/ACL変更、Organizer CRUDからのGoogle呼び出しは実装していません。

## 対象と対応付け

| Google Calendar表示名 | Organizer category | 備考 |
| --- | --- | --- |
| 大学 | `university` | 470件は件数の目安であり上限ではない |
| 仕事 | `work` | 旧名「バイト」は自動対応付けしない |
| 娯楽 | `entertainment` | 72件は件数の目安であり上限ではない |
| 生活 | `life` | 旧名「部活」は自動対応付けしない |

現在の表示名を正とします。同名カレンダーが複数ある場合、または4つのいずれかがない場合は`BLOCKING`として停止します。IDや旧名称から推測しません。

## 安全設計

- OAuth tokenには`https://www.googleapis.com/auth/calendar.readonly`など、末尾が`.readonly`のscopeだけを付与してください。書き込み可能scopeを検出したPreviewは停止します。
- Googleクライアントの公開interfaceは読み取り専用の`getGrantedScopes`、`listCalendarsPage`、`listEventsPage`、`listIncrementalEventsPage`だけです。
- Previewは全ページを読み、Import候補・検証結果・最終ページの`nextSyncToken`をPreview runへ保存します。`OrganizerEvent`と正式cursorは変更しません。
- Applyは、成功したPreviewのrun ID、有効期限30分の確認トークン、明示文字列`IMPORT`をすべて要求します。
- Eventの冪等キーは`(googleCalendarId, googleCalendarEventId)`です。タイトルと日時では統合しません。
- 同名・同時刻のローカルEventは重複候補として警告するだけです。
- 新規Importは`shareWithPartner=false`です。再Importでは既存値を上書きしません。
- `outboundEnabledAt`は常に`null`です。
- Googleへの書き込み件数はrun logのDB制約でも常に0です。

## データの保持

`OrganizerEvent`にはGoogleのカレンダーID、event ID、ETag、更新日時、sync状態、timezone、recurring event ID、original start、event type、status、recurrence原文、同期hashを保持します。

終日予定は`startDate`と排他的な`endDateExclusive`を`YYYY-MM-DD`のまま保持します。既存Plannerとの互換表示用にAsia/Tokyoの0時から導出した`startAt/endAt`も保持します。時刻予定はRFC3339のinstantをUTCで保存し、元timezoneを別に保持します。

`singleEvents=false`で取得するため、繰り返しmaster、例外、cancelled instanceを区別できます。cancelled resourceはPreview snapshotに保持しますが、初回Importでは表示Eventを作りません。Planner上での繰り返し展開はこのフェーズでは行いません。

## 増分同期

初回Import完了後は、保存済みのカレンダー別`syncToken`でGoogle側の変更を読み取れます。Google APIの全ページを取得して最終ページの`nextSyncToken`を確認した後にだけDB transactionを開始し、カレンダー単位でEvent反映・削除・cursor更新・run記録をcommitします。

- 新規Google Eventは`shareWithPartner=false`、`timetreeSyncStatus=not_requested`で作成します。
- 更新はGoogle由来フィールドだけを変更し、`shareWithPartner`とTimeTree metadataを維持します。
- `status=cancelled`は同じ`googleCalendarId + googleCalendarEventId`のGoogle由来Eventだけを削除します。存在しないIDはskipします。
- cancelled recurring exceptionも同じIDの保存済み例外だけを削除し、recurring masterには触れません。
- syncTokenが410 Goneで失効した場合は、そのカレンダーだけをfull fetchして再照合します。ローカルEventと他カレンダーのEventは削除対象になりません。
- recovery成功時だけ新しいtokenと`lastFullSyncAt`を保存します。
- API取得中はDB transactionを開きません。

状態確認と手動同期は次のCLIを使います。自動実行は有効化していません。

```bash
pnpm google-calendar:sync status
pnpm google-calendar:sync run --dry-run
pnpm google-calendar:sync run
```

`--dry-run`はGoogleから差分を読み、予定されるcreate/update/delete件数を表示しますが、Event、cursor、run logを変更しません。出力にはOAuth credentialとsync tokenを含めません。

## 環境変数

`.env`へ次を設定します。値をGitへ追加しないでください。

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ADMIN_SECRET=
```

`GOOGLE_CALENDAR_ADMIN_SECRET`は管理API専用の長いランダム値です。ブラウザJavaScriptへ渡しません。ルートComposeは既にルートとhome-dashboardの`.env`をサービスへ渡すため、Composeファイルの追加変更はありません。

## Migration

Home Serverでpull/build後に通常の起動を行うと、Dockerfileの起動コマンドが`prisma migrate deploy`を先に実行します。手動確認は次です。

```bash
docker compose exec home-dashboard ./node_modules/.bin/prisma migrate status
```

## CLI（開発checkout）

既存tokenが`invalid_grant`の場合は、次のコマンドでread-only scopeだけを要求する認証URLを生成できます。Googleの通常の同意画面、2FA、CAPTCHAは人間がそのまま完了します。

```bash
pnpm google-calendar:import auth-url
```

認証後、ブラウザが移動したURL全体を15分以内に渡します。`WRITE_ENV`の明示指定がある場合だけ、取得したrefresh tokenを`.env`へ権限`0600`で保存します。token自体は標準出力へ表示しません。

```bash
pnpm google-calendar:import oauth-exchange \
  --redirect-url '<認証後のURL>' \
  --confirm WRITE_ENV
```

一時的なPKCE verifierとstate hashはGit対象外の`data/google-calendar/oauth-session.json`へ権限`0600`で保存し、成功後に削除します。

```bash
pnpm google-calendar:import discovery
pnpm google-calendar:import preview
pnpm google-calendar:import status
pnpm google-calendar:import runs
```

`preview`は実行前後の`OrganizerEvent`件数も出力します。Preview出力のtokenはローカル承認用で、Google credentialではありません。Applyは明示承認後だけ実行します。

```bash
pnpm google-calendar:import apply --run <RUN_ID> --token <TOKEN> --confirm IMPORT
```

## Home Serverの管理API

全endpointは`x-google-calendar-admin-secret`ヘッダー必須で、secret未設定時はfail closedです。

- `GET /api/organizer/google-calendar/status`
- `GET /api/organizer/google-calendar/calendars`
- `POST /api/organizer/google-calendar/import/preview`
- `POST /api/organizer/google-calendar/import/apply`
- `GET /api/organizer/google-calendar/runs`

例:

```bash
curl -H "x-google-calendar-admin-secret: $GOOGLE_CALENDAR_ADMIN_SECRET" \
  http://127.0.0.1:3000/api/organizer/google-calendar/calendars

curl -X POST -H "x-google-calendar-admin-secret: $GOOGLE_CALENDAR_ADMIN_SECRET" \
  http://127.0.0.1:3000/api/organizer/google-calendar/import/preview
```

Apply bodyは次の3項目が必須です。

```json
{
  "runId": "preview run ID",
  "confirmationToken": "previewで一度だけ返るtoken",
  "confirm": "IMPORT"
}
```

## Previewの判定

カレンダーごとにresource数、default event数、終日/時刻、繰り返しmaster/例外、cancelled、最古/最新、ページ数、非default eventType、作成/更新/skip、重複候補を表示します。

検証は次の3段階です。

- `BLOCKING`: 書き込みscope、対象カレンダーの欠落/同名重複、event ID欠落、不正な日時、重複event ID、最終syncToken欠落。Apply不可。
- `WARNING`: タイトル欠落、未知のrecurrence、非default eventType、ローカル重複候補。
- `INFO`: 旧名称の存在など。

大学470件・娯楽72件との差は参考値として表示するだけです。仕事・生活の古い予定を含め、総数に上限は設けません。

## このフェーズで行わないこと

- Google Calendarへの送信、push通知、cronによる自動実行
- Organizer Event CRUDからのGoogle API呼び出し
- TimeTree連携
- Plannerでの繰り返し展開
- Preview後の自動Apply

Previewを確認して明示承認するまでは、Importを実行しません。
