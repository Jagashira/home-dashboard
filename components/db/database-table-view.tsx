"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TableColumn = {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKeyIndex: number;
};

type TableSummary = {
  name: string;
  rowCount: number;
  columns: TableColumn[];
  primaryKeys: string[];
};

type TablePayload = {
  ok: boolean;
  table: TableSummary;
  rows: Record<string, unknown>[];
  totalRows: number;
  visibleRows: number;
  query: string;
  limit: number;
  error?: string;
};

type Props = {
  tableName: string;
};

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function inferInputKind(column: TableColumn, value: unknown) {
  const upperType = column.type.toUpperCase();
  if (upperType.includes("INT") || upperType.includes("REAL") || upperType.includes("NUM")) {
    return "number";
  }
  if (upperType.includes("BOOL")) {
    return "boolean";
  }
  if (typeof value === "string" && (value.length > 90 || value.includes("\n"))) {
    return "textarea";
  }
  return "text";
}

function normalizeDraftValue(column: TableColumn, rawValue: string) {
  if (rawValue === "__NULL__") return null;

  const upperType = column.type.toUpperCase();
  if (upperType.includes("BOOL")) {
    return rawValue === "1";
  }
  if (upperType.includes("INT")) {
    return rawValue === "" ? null : Number.parseInt(rawValue, 10);
  }
  if (upperType.includes("REAL") || upperType.includes("NUM")) {
    return rawValue === "" ? null : Number.parseFloat(rawValue);
  }
  return rawValue;
}

export function DatabaseTableView({ tableName }: Props) {
  const [payload, setPayload] = useState<TablePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const loadRows = async (search = queryDraft) => {
    setLoading(true);
    setStatusText("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "100");
      const response = await fetch(`/api/db/tables/${encodeURIComponent(tableName)}?${params.toString()}`, {
        cache: "no-store"
      });
      const nextPayload = (await response.json()) as TablePayload;
      if (!response.ok || !nextPayload.ok) {
        setStatusText(nextPayload.error ?? "読み込み失敗");
        return;
      }
      setPayload(nextPayload);
      setQueryDraft(nextPayload.query);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows("");
  }, [tableName]);

  const rowKey = useMemo(() => {
    if (!payload) return (row: Record<string, unknown>) => JSON.stringify(row);
    return (row: Record<string, unknown>) =>
      payload.table.primaryKeys.map((key) => stringifyValue(row[key])).join("::");
  }, [payload]);

  const startEdit = (row: Record<string, unknown>) => {
    if (!payload) return;
    const nextDraft: Record<string, string> = {};
    for (const column of payload.table.columns) {
      nextDraft[column.name] = row[column.name] === null ? "__NULL__" : stringifyValue(row[column.name]);
    }
    setEditingKey(rowKey(row));
    setDraft(nextDraft);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft({});
  };

  const saveRow = async (row: Record<string, unknown>) => {
    if (!payload) return;
    const key = rowKey(row);
    const primaryKey = Object.fromEntries(payload.table.primaryKeys.map((name) => [name, row[name]]));
    const changes = Object.fromEntries(
      payload.table.columns
        .filter((column) => !payload.table.primaryKeys.includes(column.name))
        .filter((column) => draft[column.name] !== stringifyValue(row[column.name] === null ? "__NULL__" : row[column.name]))
        .map((column) => [column.name, normalizeDraftValue(column, draft[column.name])])
    );

    if (Object.keys(changes).length === 0) {
      setStatusText("変更はありません");
      setEditingKey(null);
      return;
    }

    setSavingKey(key);
    setStatusText("");
    try {
      const response = await fetch(`/api/db/tables/${encodeURIComponent(tableName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryKey, changes })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setStatusText(result.error ?? "更新失敗");
        return;
      }
      setStatusText("更新しました");
      setEditingKey(null);
      setDraft({});
      await loadRows(queryDraft);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="stack-lg">
      <section className="panel">
        <div className="head-actions">
          <div>
            <p className="eyebrow">Database</p>
            <h1>{tableName}</h1>
            <p className="status-text">
              {payload
                ? `${payload.visibleRows} / ${payload.totalRows} rows`
                : "テーブルを読み込み中"}
            </p>
          </div>
          <Link className="button-secondary" href="/db">
            一覧へ戻る
          </Link>
        </div>

        <form
          className="db-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            loadRows(queryDraft);
          }}
        >
          <label className="field">
            <span>検索</span>
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="タイトル、URL、id などを横断検索"
            />
          </label>
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "読み込み中..." : "検索"}
          </button>
        </form>

        <p className={`status-text refresh-status ${statusText ? "" : "is-empty"}`}>{statusText || "."}</p>
      </section>

      <section className="panel">
        {!payload ? (
          <p className="status-text">読み込み中...</p>
        ) : (
          <>
            <div className="db-meta-grid">
              <div className="db-meta-card">
                <span>主キー</span>
                <strong>{payload.table.primaryKeys.join(", ") || "なし"}</strong>
              </div>
              <div className="db-meta-card">
                <span>列数</span>
                <strong>{payload.table.columns.length}</strong>
              </div>
              <div className="db-meta-card">
                <span>編集</span>
                <strong>{payload.table.primaryKeys.length > 0 ? "可能" : "不可"}</strong>
              </div>
            </div>

            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>操作</th>
                    {payload.table.columns.map((column) => (
                      <th key={column.name}>
                        <div>{column.name}</div>
                        <small>{column.type || "TEXT"}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.rows.map((row) => {
                    const key = rowKey(row);
                    const isEditing = key === editingKey;

                    return (
                      <tr key={key}>
                        <td className="db-actions-cell">
                          {isEditing ? (
                            <div className="db-action-stack">
                              <button
                                className="button-primary"
                                type="button"
                                disabled={savingKey === key}
                                onClick={() => saveRow(row)}
                              >
                                {savingKey === key ? "保存中..." : "保存"}
                              </button>
                              <button className="button-secondary" type="button" onClick={cancelEdit}>
                                戻す
                              </button>
                            </div>
                          ) : (
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={payload.table.primaryKeys.length === 0}
                              onClick={() => startEdit(row)}
                            >
                              編集
                            </button>
                          )}
                        </td>
                        {payload.table.columns.map((column) => {
                          const value = row[column.name];
                          const inputKind = inferInputKind(column, value);

                          if (!isEditing || payload.table.primaryKeys.includes(column.name)) {
                            return (
                              <td key={column.name} className={payload.table.primaryKeys.includes(column.name) ? "db-pk-cell" : ""}>
                                <span className="db-cell-text">{value === null ? "NULL" : stringifyValue(value)}</span>
                              </td>
                            );
                          }

                          if (inputKind === "textarea") {
                            return (
                              <td key={column.name}>
                                <textarea
                                  className="db-editor db-editor-area"
                                  value={draft[column.name] ?? ""}
                                  onChange={(event) =>
                                    setDraft((current) => ({ ...current, [column.name]: event.target.value }))
                                  }
                                />
                              </td>
                            );
                          }

                          if (inputKind === "boolean") {
                            return (
                              <td key={column.name}>
                                <select
                                  className="db-editor"
                                  value={draft[column.name] ?? ""}
                                  onChange={(event) =>
                                    setDraft((current) => ({ ...current, [column.name]: event.target.value }))
                                  }
                                >
                                  <option value="1">true</option>
                                  <option value="0">false</option>
                                  <option value="__NULL__">NULL</option>
                                </select>
                              </td>
                            );
                          }

                          return (
                            <td key={column.name}>
                              <input
                                className="db-editor"
                                type={inputKind === "number" ? "number" : "text"}
                                value={draft[column.name] ?? ""}
                                onChange={(event) =>
                                  setDraft((current) => ({ ...current, [column.name]: event.target.value }))
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
