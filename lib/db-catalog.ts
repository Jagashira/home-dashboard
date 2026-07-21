export type TableDomainKey = "news" | "tasks" | "billing" | "shop" | "system";

export type TableCatalogEntry = {
  tableName: string;
  title: string;
  domain: TableDomainKey;
  databaseLabel: string;
  summary: string;
  purpose: string;
  columnLabels: Record<string, string>;
};

export const TABLE_DOMAIN_META: Record<
  TableDomainKey,
  { title: string; description: string }
> = {
  news: {
    title: "News",
    description: "ニュース収集とその設定まわり"
  },
  tasks: {
    title: "Tasks / Planner",
    description: "今日やること、予定、進捗管理"
  },
  billing: {
    title: "Billing",
    description: "請求や支払い関連のデータ"
  },
  shop: {
    title: "Shop",
    description: "買い物メモや購入候補"
  },
  system: {
    title: "System / Settings",
    description: "アプリ全体の設定や補助テーブル"
  }
};

const CATALOG: Record<string, TableCatalogEntry> = {
  articles: {
    tableName: "articles",
    title: "記事一覧",
    domain: "news",
    databaseLabel: "News DB",
    summary: "収集したニュース記事の本体です。",
    purpose: "記事タイトル、URL、半導体理解メモ、言語、表示状態などを保持します。",
    columnLabels: {
      id: "記事ID",
      topic_id: "トピックID",
      source_id: "取得元ID",
      fetch_run_id: "取得バッチID",
      external_id: "外部記事ID",
      title: "タイトル",
      url: "記事URL",
      source_label: "媒体名",
      published_at: "公開日時",
      fetched_at: "取得日時",
      content: "本文",
      summary: "要約",
      semiconductor_analysis: "半導体理解メモ",
      semiconductor_analysis_model: "半導体分析モデル",
      semiconductor_analysis_cost_usd: "半導体分析コストUSD",
      semiconductor_analysis_cost_jpy: "半導体分析コストJPY",
      semiconductor_analyzed_at: "半導体分析日時",
      language: "言語",
      is_japanese: "日本語判定",
      score: "スコア",
      is_hidden: "非表示",
      is_favorite: "お気に入り",
      created_at: "作成日時",
    }
  },
  fetch_runs: {
    tableName: "fetch_runs",
    title: "取得実行履歴",
    domain: "news",
    databaseLabel: "News DB",
    summary: "ニュース取得ジョブの実行履歴です。",
    purpose: "何件取りにいって、何件取れたか、成功したか失敗したかを記録します。",
    columnLabels: {
      id: "実行ID",
      run_date: "実行日",
      days: "対象日数",
      total_requested: "要求件数",
      total_fetched: "取得件数",
      status: "状態",
      error_message: "エラー内容",
      started_at: "開始日時",
      finished_at: "終了日時"
    }
  },
  topics: {
    tableName: "topics",
    title: "ニューストピック",
    domain: "news",
    databaseLabel: "News DB",
    summary: "ニュースを分類するテーマ一覧です。",
    purpose: "表示順や検索クエリ、配分率などを持ちます。",
    columnLabels: {
      id: "トピックID",
      name: "トピック名",
      query: "検索クエリ",
      is_active: "有効",
      allocation_percent: "配分率",
      display_order: "表示順",
      created_at: "作成日時",
      updated_at: "更新日時"
    }
  },
  sources: {
    tableName: "sources",
    title: "ニュース取得元",
    domain: "news",
    databaseLabel: "News DB",
    summary: "RSS や API などの取得元一覧です。",
    purpose: "どのソースを有効にするか、どんな設定で取るかを持ちます。",
    columnLabels: {
      id: "取得元ID",
      source_type: "取得方式",
      source_name: "取得元名",
      is_active: "有効",
      config_json: "設定JSON",
      created_at: "作成日時",
      updated_at: "更新日時"
    }
  },
  app_settings: {
    tableName: "app_settings",
    title: "ニュース取得設定",
    domain: "system",
    databaseLabel: "System DB",
    summary: "ニュース取得の基本設定です。",
    purpose: "一度に何件取るか、何日分を見るか、日本語優先かを持ちます。",
    columnLabels: {
      id: "設定ID",
      total_requested: "要求件数",
      days: "対象日数",
      prefer_japanese: "日本語優先",
      updated_at: "更新日時"
    }
  },
  Task: {
    tableName: "Task",
    title: "タスク本体",
    domain: "tasks",
    databaseLabel: "Planner DB",
    summary: "やること管理の中心テーブルです。",
    purpose: "タイトル、工数、進捗、期限、重要度などを持ちます。",
    columnLabels: {
      id: "タスクID",
      title: "タスク名",
      note: "メモ",
      minutes: "想定分数",
      progressMinutes: "進捗分数",
      canSplit: "分割可",
      importance: "重要度",
      fatigue: "疲労度",
      urgency: "緊急度",
      dueDate: "締切日",
      targetDate: "着手目安日",
      status: "状態",
      createdAt: "作成日時",
      updatedAt: "更新日時"
    }
  },
  CalendarEvent: {
    tableName: "CalendarEvent",
    title: "予定一覧",
    domain: "tasks",
    databaseLabel: "Planner DB",
    summary: "カレンダーから同期した予定です。",
    purpose: "予定名、開始終了時刻、タグ、疲労度を持ちます。",
    columnLabels: {
      id: "予定ID",
      title: "予定名",
      startAt: "開始日時",
      endAt: "終了日時",
      tag: "タグ",
      fatigue: "疲労度",
      source: "取得元",
      createdAt: "作成日時"
    }
  }
};

function startCase(value: string) {
  return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function getTableCatalog(tableName: string): TableCatalogEntry {
  const known = CATALOG[tableName];
  if (known) return known;

  return {
    tableName,
    title: startCase(tableName),
    domain: "system",
    databaseLabel: "Local DB",
    summary: "このテーブルの説明はまだ未設定です。",
    purpose: "中身を見て役割を確認してください。",
    columnLabels: {}
  };
}

export function getColumnLabel(tableName: string, columnName: string) {
  const catalog = getTableCatalog(tableName);
  return catalog.columnLabels[columnName] ?? startCase(columnName);
}

export function listDomainEntries(domain: TableDomainKey) {
  return Object.values(CATALOG).filter((entry) => entry.domain === domain);
}
