"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXPENSE_CATEGORIES = [
  "食費",
  "日用品",
  "交通費",
  "交際費",
  "医療費",
  "教育費",
  "公共料金",
  "趣味娯楽",
  "ペット",
  "育児子供",
  "美容",
  "衣服",
  "保険税金",
  "家電家具",
  "プレゼント",
  "イベント",
  "修理メンテナンス",
  "サブスクリプション",
  "その他",
] as const;

const EXPENSE_PAYMENT_METHODS = [
  "現金",
  "クレジット",
  "交通系",
  "paypay",
  "starbucks card",
  "その他",
] as const;

type ExpenseItem = {
  id: string;
  date: string;
  amount: number;
  category: string;
  paymentMethod: string;
  storeName: string;
  memo: string | null;
};

type EditState = {
  id: string;
  date: string;
  amount: string;
  category: string;
  paymentMethod: string;
  storeName: string;
  memo: string;
};

function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${y}/${m}/${d}`;
}

function formatYen(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  return `${sign}¥${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function ExpenseListManager({ items }: { items: ExpenseItem[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  async function onDelete(id: string) {
    const confirmed = window.confirm("この支出を削除しますか？");
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/budget/entries/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert(data.error ?? "削除に失敗しました");
        return;
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(item: ExpenseItem) {
    setEditing({
      id: item.id,
      date: item.date,
      amount: String(item.amount),
      category: item.category,
      paymentMethod: item.paymentMethod,
      storeName: item.storeName,
      memo: item.memo ?? "",
    });
  }

  async function onSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/budget/entries/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editing.date,
          amount: Number(editing.amount),
          category: editing.category,
          paymentMethod: editing.paymentMethod,
          storeName: editing.storeName,
          memo: editing.memo,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert(data.error ?? "更新に失敗しました");
        return;
      }
      setEditing(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="panel budget-list-card">
        <h3>支出リスト</h3>
        {items.length === 0 ? (
          <p className="status-text">この期間の支出はありません</p>
        ) : (
          <div className="budget-list">
            {items.map((item) => (
              <article className="budget-list-item" key={item.id}>
                <div>
                  <p className="budget-list-date">{formatDate(item.date)}</p>
                  <p className="budget-list-name">{item.storeName}</p>
                  <p className="budget-list-meta">
                    {item.category} / {item.paymentMethod}
                  </p>
                  {item.memo ? (
                    <p className="budget-list-memo">{item.memo}</p>
                  ) : null}
                  <div className="budget-list-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => openEdit(item)}
                    >
                      編集
                    </button>
                    <button
                      className="button-secondary budget-delete-button"
                      type="button"
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                </div>
                <strong>{formatYen(item.amount)}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="支出編集"
        >
          <section className="modal-card budget-edit-modal">
            <div className="modal-header">
              <h3>支出を編集</h3>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                閉じる
              </button>
            </div>
            <form className="stack-md" onSubmit={onSaveEdit}>
              <div className="grid-2">
                <label className="field">
                  <span>日付</span>
                  <input
                    type="date"
                    required
                    value={editing.date}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev ? { ...prev, date: event.target.value } : prev,
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>金額 (円)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={editing.amount}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev ? { ...prev, amount: event.target.value } : prev,
                      )
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>店名</span>
                <input
                  required
                  value={editing.storeName}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev ? { ...prev, storeName: event.target.value } : prev,
                    )
                  }
                />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>カテゴリ</span>
                  <select
                    value={editing.category}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev ? { ...prev, category: event.target.value } : prev,
                      )
                    }
                  >
                    {EXPENSE_CATEGORIES.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>支払い方法</span>
                  <select
                    value={editing.paymentMethod}
                    onChange={(event) =>
                      setEditing((prev) =>
                        prev
                          ? { ...prev, paymentMethod: event.target.value }
                          : prev,
                      )
                    }
                  >
                    {EXPENSE_PAYMENT_METHODS.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>メモ (任意)</span>
                <textarea
                  rows={3}
                  value={editing.memo}
                  onChange={(event) =>
                    setEditing((prev) =>
                      prev ? { ...prev, memo: event.target.value } : prev,
                    )
                  }
                />
              </label>

              <div className="actions-row">
                <button
                  className="button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "保存中..." : "更新する"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
