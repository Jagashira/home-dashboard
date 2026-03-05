"use client";

import { useEffect, useRef, useState } from "react";
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
const INCOME_CATEGORIES = [
  "給与",
  "賞与",
  "副業",
  "投資",
  "還付金",
  "臨時収入",
  "その他",
] as const;
const INCOME_METHODS = ["銀行振込", "現金", "その他"] as const;
const SOURCE_ACCOUNTS = ["三井住友", "ゆうちょ", "その他"] as const;

type BudgetFormMode = "expense" | "income";

type BudgetEntryFormProps = {
  mode: BudgetFormMode;
};

type FormState = {
  date: string;
  amount: string;
  category: string;
  paymentMethod: string;
  storeName: string;
  sourceAccount: string;
  memo: string;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function BudgetEntryForm({ mode }: BudgetEntryFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okText, setOkText] = useState("");
  const [storeSuggestions, setStoreSuggestions] = useState<Array<{ name: string; usedCount: number }>>([]);
  const [showStoreSuggestions, setShowStoreSuggestions] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExpense = mode === "expense";

  const [form, setForm] = useState<FormState>({
    date: todayYmd(),
    amount: "",
    category: isExpense ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
    paymentMethod: isExpense ? EXPENSE_PAYMENT_METHODS[0] : INCOME_METHODS[0],
    storeName: "",
    sourceAccount: SOURCE_ACCOUNTS[0],
    memo: "",
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!isExpense) {
      setStoreSuggestions([]);
      return;
    }

    const q = form.storeName.trim();
    if (q.length < 1) {
      setStoreSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/budget/stores?q=${encodeURIComponent(q)}&limit=8`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (response.ok && data.ok && Array.isArray(data.items)) {
          setStoreSuggestions(data.items);
        }
      } catch {
        // ignore autocomplete fetch errors
      }
    }, 140);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.storeName, isExpense]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setOkText("");

    try {
      const payload = {
        entryType: isExpense ? "EXPENSE" : "INCOME",
        date: form.date,
        amount: Number(form.amount),
        category: form.category,
        paymentMethod: form.paymentMethod,
        storeName: isExpense ? form.storeName : form.storeName || "入金",
        sourceAccount: form.sourceAccount,
        memo: form.memo,
      };

      const response = await fetch("/api/budget/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error ?? "入力保存に失敗しました");
        return;
      }

      setOkText("保存しました");
      setForm((prev) => ({
        ...prev,
        amount: "",
        storeName: "",
        memo: "",
      }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "入力保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel budget-form-card">
      <h2>{isExpense ? "支出入力" : "収入入力"}</h2>
      <form className="stack-md" onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>日付</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </label>

          <label className="field">
            <span>金額 (円)</span>
            <input
              type="number"
              min={1}
              step={1}
              required
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
            />
          </label>
        </div>

        {isExpense ? (
          <label className="field">
            <span>店名</span>
            <input
              required
              value={form.storeName}
              onChange={(event) => update("storeName", event.target.value)}
              onFocus={() => setShowStoreSuggestions(true)}
              onBlur={() => {
                blurTimerRef.current = setTimeout(() => setShowStoreSuggestions(false), 120);
              }}
              placeholder="スーパー、コンビニ、EC など"
            />
            {showStoreSuggestions && storeSuggestions.length > 0 ? (
              <div className="store-suggestion-list" role="listbox" aria-label="店名候補">
                {storeSuggestions.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className="store-suggestion-item"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      update("storeName", item.name);
                      setShowStoreSuggestions(false);
                    }}
                  >
                    <span>{item.name}</span>
                    <small>{item.usedCount}回</small>
                  </button>
                ))}
              </div>
            ) : null}
          </label>
        ) : (
          <label className="field">
            <span>入金元 (任意)</span>
            <input
              value={form.storeName}
              onChange={(event) => update("storeName", event.target.value)}
              placeholder="会社名、振込元など"
            />
          </label>
        )}

        <div className="grid-2">
          <label className="field">
            <span>カテゴリ</span>
            <select
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {(isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
                (item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field">
            <span>{isExpense ? "支払い方法" : "入金方法"}</span>
            <select
              value={form.paymentMethod}
              onChange={(event) => update("paymentMethod", event.target.value)}
            >
              {(isExpense ? EXPENSE_PAYMENT_METHODS : INCOME_METHODS).map(
                (item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        {!isExpense ? (
          <label className="field">
            <span>入金先口座</span>
            <select
              value={form.sourceAccount}
              onChange={(event) => update("sourceAccount", event.target.value)}
            >
              {SOURCE_ACCOUNTS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>メモ (任意)</span>
          <textarea
            rows={2}
            value={form.memo}
            onChange={(event) => update("memo", event.target.value)}
            placeholder="補足メモ"
          />
        </label>

        <div className="actions-row">
          <button
            className="button-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "保存中..." : "保存する"}
          </button>
          {okText ? <p className="status-text">{okText}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
