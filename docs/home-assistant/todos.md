# Home Dashboard Todo API

Home Dashboard の `Task` テーブルを唯一の正本として、Home Assistant から未完了Todoを読み取るためのAPIです。Home Assistant側にはTodoを複製せず、RESTセンサーの属性として最新レスポンスを保持します。

## API

- URL: `http://100.73.222.16:3000/api/ha/todos`
- Method: `GET`
- 認証: `x-ha-secret` ヘッダーにHome Dashboardの `HA_SECRET` と同じ値を設定
- 並び順: Web Applicationと同じ優先順位（期限切れ、期限直前、着手推奨、重要度、残工数）
- フィルタ: `status = todo` のみ
- 件数制限: `?limit=3` のように指定可能。未指定時は未完了Todoをすべて返す
- キャッシュ: `Cache-Control: no-store`

`HA_SECRET` が未設定の場合は、既存のHome Assistant連携APIと同様に認証なしになります。LAN内でも意図しない端末からTodoを読めるため、本番では必ず設定してください。クエリ文字列の `?secret=` も既存互換として利用できますが、ログに残りやすいためヘッダーを推奨します。

## Response

```json
{
  "ok": true,
  "date": "2026-09-21",
  "count": 3,
  "displayedCount": 3,
  "items": [
    {
      "id": "cm123",
      "title": "提出資料を送る",
      "completed": false,
      "status": "todo",
      "displayOrder": 1,
      "importance": 5,
      "targetDate": "2026-09-21T00:00:00.000Z",
      "dueDate": "2026-09-22T00:00:00.000Z",
      "isToday": true,
      "warningLevel": "critical",
      "progress": {
        "completedMinutes": 30,
        "totalMinutes": 90,
        "percent": 33
      }
    }
  ]
}
```

主なJSON path:

- Todoタイトル: `$.items[*].title`
- Todo ID: `$.items[*].id`
- 表示順: `$.items[*].displayOrder`
- Todo総数: `$.count`
- 今日のTodo: `$.items[?(@.isToday == true)]`

## Home Assistant設定例

`secrets.yaml`:

```yaml
home_dashboard_ha_secret: "Home DashboardのHA_SECRETと同じ値"
```

`configuration.yaml`:

```yaml
rest:
  - resource: "http://100.73.222.16:3000/api/ha/todos?limit=3"
    scan_interval: 300
    headers:
      x-ha-secret: !secret home_dashboard_ha_secret
    sensor:
      - name: Home Dashboard Todo
        unique_id: home_dashboard_todo
        value_template: "{{ value_json.count }}"
        json_attributes:
          - items
          - displayedCount
          - date
```

先頭Todoは `state_attr('sensor.home_dashboard_todo', 'items')[0]['title']` で参照できます。更新間隔は5分（`scan_interval: 300`）を推奨します。ロック画面表示だけなら1分未満のポーリングは不要です。

`100.73.222.16` は `homeserver-desktop` のTailscaleアドレスです。Home AssistantとiPhoneを同じTailnetへ接続してください。Todoの追加・更新・完了・削除は引き続きWeb Applicationで行います。

## curl確認

```bash
curl -sS \
  -H "x-ha-secret: $HA_SECRET" \
  "http://100.73.222.16:3000/api/ha/todos?limit=3"
```
