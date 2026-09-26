# Organizer → Google Calendar outbound sync

OrganizerEventを予定管理のMASTERとして、将来Google Calendarへ一方向送信するための実装です。現在の本番環境では`GoogleCalendarMapping.outboundEnabledAt=null`、OAuth scopeは`calendar.readonly`のため、Googleへの書き込みは実行できません。自動実行設定もありません。

## 現在使えるCLI

```bash
pnpm google-calendar:outbound status
pnpm google-calendar:outbound run --dry-run
```

`status`はカレンダーごとの有効状態と候補件数をDBから読み取ります。`--dry-run`はGoogle Eventを読み取ってETag競合を検査しますが、GoogleとDBのどちらにも書き込みません。結果には`created`、`updated`、`deleted`、`conflicts`、`skipped`、常に0の`googleWriteCount`が含まれます。

実書き込み経路は次の条件がすべて成立しない限り拒否します。

1. CLIに`--confirm WRITE_GOOGLE_CALENDAR`がある
2. 環境変数`GOOGLE_CALENDAR_OUTBOUND_WRITES_ENABLED`が正確に`ENABLED_AFTER_REAUTH`
3. 対象カレンダーの`GoogleCalendarMapping.outboundEnabledAt`が設定済み
4. OAuth tokenにGoogle Event write scopeがある

このリポジトリには`outboundEnabledAt`を設定するCLIやAPIを用意していません。現在の設定を誤って有効化する経路はありません。

## State machine

| 状態 | 判定 | 次の動作 |
| --- | --- | --- |
| Local only | Google IDなし、`googleOutboundManaged=false` | `CREATE`候補 |
| Inbound owned | Google IDあり、`googleOutboundManaged=false` | `SKIP`。編集・削除をGoogleへ送らない |
| Managed synced | `googleOutboundManaged=true`、現在hashとbase hashが一致 | `SKIP` |
| Managed dirty | 現在hashとbase hashが不一致、Google ETag一致 | `UPDATE`候補 |
| Conflict | ローカル変更あり、Google ETag不一致・identity不足・category移動 | 自動変更しない |
| Pending deletion | managed Event削除時のtombstone | ETag一致時だけ`DELETE`候補 |
| Deleted | Google delete成功、またはGoogle上ですでに削除済み | tombstoneを完了状態にする |

既存Import Eventはmigration後も`googleOutboundManaged=false`です。Home Dashboard上で編集・削除してもGoogle Eventを変更しません。OrganizerからのGoogle CREATEが成功したEventだけがmanagedへ遷移します。

## CREATE

categoryに対応する`GoogleCalendarMapping`を送信先に使います。`shareWithPartner`は判定に使いません。

Google Event IDはOrganizerEvent IDから決定的に生成し、private extended propertyへ元のOrganizerEvent IDを保存します。Google作成後のDB更新だけが失敗しても、再実行時は同じEvent IDを取得し、所有マーカーが一致する場合だけ再リンクします。別EventならCONFLICTです。

Google create成功後にだけGoogle ID、ETag、updated、同期日時、hash、managed状態をDBへ保存します。Google失敗時はローカルEventを連携済みにしません。

## UPDATEと競合

`googleOutboundBaseHash`には最後にGoogleと一致したローカル書き込み対象フィールドのhashを保持します。title、description、category、開始・終了、終日状態、locationを比較します。

UPDATE前にGoogle Eventを読み、保存済みETagと一致する場合だけ候補にします。実際のpatchにも`If-Match`を付けるため、判定後にGoogle側が変更された場合は412となり自動上書きしません。Google公式も、更新・削除の競合防止にETagと`If-Match`を使う方法を案内しています。

inbound syncはmanaged Eventに未同期のローカル変更がある場合、そのEventを上書きしません。Google側も変更されていれば次のoutbound判定でCONFLICTになります。ローカルがdirtyでなければ通常どおりGoogle変更を取り込み、新しいbase hashを保存するためループしません。

## DELETE

managed EventをHome Dashboardから削除すると、同じDB transaction内で`GoogleCalendarOutboundDeletion`を作成してからOrganizerEventを物理削除します。tombstoneはGoogle calendar ID、event ID、ETagを保持します。

Local-only Eventとinbound-owned Eventの削除ではtombstoneを作らず、Google deleteを呼びません。Google deleteは保存済みETagと現在ETagが一致する場合だけ実行し、成功後にだけtombstoneを`deleted`へ変更します。

## OAuth

現在の`https://www.googleapis.com/auth/calendar.readonly`は変更しません。将来、対象4カレンダーが認証ユーザー所有であることを確認できる場合、最小候補は次です。

```text
https://www.googleapis.com/auth/calendar.events.owned
```

所有外の書き込み可能な共有カレンダーも対象にする場合は`calendar.events`が必要です。広い`calendar` scopeは不要です。inboundのread-only tokenと分離するため、outbound用refresh tokenは`GOOGLE_OUTBOUND_REFRESH_TOKEN`として扱えます。今回、再認証やtoken取得は行っていません。

## 対象外

- TASK、TIME_BLOCK、ROUTINE
- TimeTree同期
- systemd timer、cron、自動実行
- Calendar、ACL、CalendarListへの書き込み
- OAuth再認証
