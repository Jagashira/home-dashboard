"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const EXPENSE_CATEGORIES = ["食費", "日用品", "交通", "医療", "娯楽", "通信", "光熱費", "その他"];
const PAYMENT_METHODS = ["現金", "クレジット", "デビット", "QR", "口座振替", "その他"];
const INCOME_CATEGORIES = ["給与", "副業", "返金", "その他"];
const SOURCE_ACCOUNTS = ["三井住友", "ゆうちょ", "その他"];

type FormState = {
  entryType: "EXPENSE" | "INCOME";
  date: string;
  amount: string;
  category: string;
  paymentMethod: string;
  sourceAccount: string;
  storeName: string;
  memo: string;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function BudgetEntryForm({
  initialEntryType = "EXPENSE",
  lockEntryType = false
}: {
  initialEntryType?: "EXPENSE" | "INCOME";
  lockEntryType?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okText, setOkText] = useState("");
  const [form, setForm] = useState<FormState>({
    entryType: initialEntryType,
    date: todayYmd(),
    amount: "",
    category: initialEntryType === "INCOME" ? "給与" : "食費",
    paymentMethod: initialEntryType === "INCOME" ? "銀行入金" : "クレジット",
    sourceAccount: "三井住友",
    storeName: "",
    memo: ""
  });

  const categoryOptions = useMemo(
    () => (form.entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [form.entryType]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setOkText("");

    try {
      const response = await fetch("/api/budget/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount)
        })
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
        memo: ""
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
      <h2>収支入力</h2>
      <form className="stack-md" onSubmit={onSubmit}>
        {!lockEntryType ? (
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${form.entryType === "EXPENSE" ? "chip-active" : ""}`}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  entryType: "EXPENSE",
                  category: EXPENSE_CATEGORIES[0],
                  paymentMethod: "クレジット"
                }))
              }
            >
              支出
            </button>
            <button
              type="button"
              className={`chip ${form.entryType === "INCOME" ? "chip-active" : ""}`}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  entryType: "INCOME",
                  category: INCOME_CATEGORIES[0],
                  paymentMethod: "銀行入金"
                }))
              }
            >
              収入
            </button>
          </div>
        ) : null}

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

        <div className="grid-2">
          <label className="field">
            <span>カテゴリ</span>
            <input
              list="budget-categories"
              required
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            />
            <datalist id="budget-categories">
              {categoryOptions.map((item) => (
                <option value={item} key={item} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>支払い方法</span>
            <input
              list="budget-payment-methods"
              required
              value={form.paymentMethod}
              onChange={(event) => update("paymentMethod", event.target.value)}
            />
            <datalist id="budget-payment-methods">
              {(form.entryType === "INCOME" ? ["銀行入金", "振込", "現金", "その他"] : PAYMENT_METHODS).map(
                (item) => (
                  <option value={item} key={item} />
                )
              )}
            </datalist>
          </label>
        </div>

        <div className="grid-2">
          {form.entryType === "INCOME" ? (
            <label className="field">
              <span>入金元口座</span>
              <input
                list="budget-source-accounts"
                required
                value={form.sourceAccount}
                onChange={(event) => update("sourceAccount", event.target.value)}
              />
              <datalist id="budget-source-accounts">
                {SOURCE_ACCOUNTS.map((item) => (
                  <option value={item} key={item} />
                ))}
              </datalist>
            </label>
          ) : (
            <label className="field">
              <span>店名</span>
              <input
                required
                value={form.storeName}
                onChange={(event) => update("storeName", event.target.value)}
                placeholder="スーパー、コンビニ、EC など"
              />
            </label>
          )}

          {form.entryType === "INCOME" ? (
            <label className="field">
              <span>入金名目</span>
              <input
                required
                value={form.storeName}
                onChange={(event) => update("storeName", event.target.value)}
                placeholder="給与、振込名など"
              />
            </label>
          ) : (
            <label className="field">
              <span>支払口座</span>
              <input
                list="budget-source-accounts"
                value={form.sourceAccount}
                onChange={(event) => update("sourceAccount", event.target.value)}
                placeholder="三井住友、ゆうちょ など"
              />
              <datalist id="budget-source-accounts">
                {SOURCE_ACCOUNTS.map((item) => (
                  <option value={item} key={item} />
                ))}
              </datalist>
            </label>
          )}
        </div>

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
          <button className="button-primary" type="submit" disabled={submitting}>
            {submitting ? "保存中..." : "保存する"}
          </button>
          {okText ? <p className="status-text">{okText}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
