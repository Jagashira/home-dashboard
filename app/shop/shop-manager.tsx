"use client";

import { useEffect, useState } from "react";

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  preferredBuyQuantity: number;
  note: string | null;
};

type ShoppingItem = {
  id: string;
  inventoryItemId: string | null;
  name: string;
  quantity: number;
  unit: string;
  status: "todo" | "done";
  store: string | null;
  note: string | null;
};

type OverviewPayload = {
  inventoryItems: InventoryItem[];
  shortages: InventoryItem[];
  shoppingItems: ShoppingItem[];
  purchasedItems: ShoppingItem[];
  summary: {
    inventoryCount: number;
    shortageCount: number;
    shoppingCount: number;
    purchasedCount: number;
  };
};

type InventoryForm = {
  name: string;
  category: string;
  location: string;
  unit: string;
  currentQuantity: string;
  minimumQuantity: string;
  preferredBuyQuantity: string;
  note: string;
};

type ShoppingForm = {
  inventoryItemId: string;
  name: string;
  quantity: string;
  unit: string;
  store: string;
  note: string;
};

type EditableInventoryForm = InventoryForm;

type EditableShoppingForm = {
  name: string;
  quantity: string;
  unit: string;
  store: string;
  note: string;
};

const initialInventoryForm: InventoryForm = {
  name: "",
  category: "",
  location: "",
  unit: "個",
  currentQuantity: "0",
  minimumQuantity: "1",
  preferredBuyQuantity: "1",
  note: ""
};

const initialShoppingForm: ShoppingForm = {
  inventoryItemId: "",
  name: "",
  quantity: "1",
  unit: "個",
  store: "",
  note: ""
};

function formatQuantity(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function shortageTone(item: Pick<InventoryItem, "currentQuantity" | "minimumQuantity">) {
  const gap = item.currentQuantity - item.minimumQuantity;
  if (gap < 0) return "critical";
  if (gap === 0) return "warning";
  return "safe";
}

function toEditableInventoryForm(item: InventoryItem): EditableInventoryForm {
  return {
    name: item.name,
    category: item.category ?? "",
    location: item.location ?? "",
    unit: item.unit,
    currentQuantity: `${item.currentQuantity}`,
    minimumQuantity: `${item.minimumQuantity}`,
    preferredBuyQuantity: `${item.preferredBuyQuantity}`,
    note: item.note ?? ""
  };
}

function toEditableShoppingForm(item: ShoppingItem): EditableShoppingForm {
  return {
    name: item.name,
    quantity: `${item.quantity}`,
    unit: item.unit,
    store: item.store ?? "",
    note: item.note ?? ""
  };
}

export function ShopManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeTab, setActiveTab] = useState<"inventory" | "shopping">("shopping");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [inventoryForm, setInventoryForm] = useState(initialInventoryForm);
  const [shoppingForm, setShoppingForm] = useState(initialShoppingForm);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);
  const [editingInventoryForm, setEditingInventoryForm] = useState<EditableInventoryForm | null>(null);
  const [editingShoppingForm, setEditingShoppingForm] = useState<EditableShoppingForm | null>(null);

  const loadOverview = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/shop/overview", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "読み込み失敗");
        return;
      }
      setOverview(payload);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(true);
  }, []);

  const submitInventory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/shop/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inventoryForm,
          currentQuantity: Number(inventoryForm.currentQuantity),
          minimumQuantity: Number(inventoryForm.minimumQuantity),
          preferredBuyQuantity: Number(inventoryForm.preferredBuyQuantity)
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "在庫の保存に失敗しました");
        return;
      }
      setInventoryForm(initialInventoryForm);
      setStatusText("在庫品目を追加しました");
      await loadOverview();
    } finally {
      setSaving(false);
    }
  };

  const submitShopping = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/shop/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shoppingForm,
          inventoryItemId: shoppingForm.inventoryItemId || null,
          quantity: Number(shoppingForm.quantity)
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "買い物リストの保存に失敗しました");
        return;
      }
      setShoppingForm(initialShoppingForm);
      setStatusText(payload.merged ? "既存の買い物項目に数量を加算しました" : "買い物リストへ追加しました");
      await loadOverview();
    } finally {
      setSaving(false);
    }
  };

  const patchInventory = async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(`/api/shop/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "在庫更新失敗");
    }
  };

  const patchShopping = async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(`/api/shop/shopping/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "買い物項目更新失敗");
    }
  };

  const deleteInventory = async (id: string) => {
    if (!window.confirm("この在庫品目を削除しますか？")) return;
    await fetch(`/api/shop/inventory/${id}`, { method: "DELETE" });
    setStatusText("在庫品目を削除しました");
    await loadOverview();
  };

  const deleteShopping = async (id: string) => {
    if (!window.confirm("この買い物項目を削除しますか？")) return;
    await fetch(`/api/shop/shopping/${id}`, { method: "DELETE" });
    setStatusText("買い物項目を削除しました");
    await loadOverview();
  };

  const addShortageToShopping = async (item: InventoryItem) => {
    setSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/shop/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId: item.id,
          quantity: item.preferredBuyQuantity
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "買い物リスト追加失敗");
        return;
      }
      setStatusText(payload.merged ? "既存の買い物項目に加算しました" : "不足品を買い物リストへ追加しました");
      setActiveTab("shopping");
      await loadOverview();
    } finally {
      setSaving(false);
    }
  };

  const startEditInventory = (item: InventoryItem) => {
    setEditingInventoryId(item.id);
    setEditingInventoryForm(toEditableInventoryForm(item));
  };

  const cancelEditInventory = () => {
    setEditingInventoryId(null);
    setEditingInventoryForm(null);
  };

  const saveEditInventory = async (id: string) => {
    if (!editingInventoryForm) return;

    setSaving(true);
    setStatusText("");
    try {
      await patchInventory(id, {
        name: editingInventoryForm.name,
        category: editingInventoryForm.category,
        location: editingInventoryForm.location,
        unit: editingInventoryForm.unit,
        currentQuantity: Number(editingInventoryForm.currentQuantity),
        minimumQuantity: Number(editingInventoryForm.minimumQuantity),
        preferredBuyQuantity: Number(editingInventoryForm.preferredBuyQuantity),
        note: editingInventoryForm.note
      });
      cancelEditInventory();
      setStatusText("在庫を更新しました");
      await loadOverview();
    } finally {
      setSaving(false);
    }
  };

  const startEditShopping = (item: ShoppingItem) => {
    setEditingShoppingId(item.id);
    setEditingShoppingForm(toEditableShoppingForm(item));
  };

  const cancelEditShopping = () => {
    setEditingShoppingId(null);
    setEditingShoppingForm(null);
  };

  const saveEditShopping = async (id: string) => {
    if (!editingShoppingForm) return;

    setSaving(true);
    setStatusText("");
    try {
      await patchShopping(id, {
        name: editingShoppingForm.name,
        quantity: Number(editingShoppingForm.quantity),
        unit: editingShoppingForm.unit,
        store: editingShoppingForm.store,
        note: editingShoppingForm.note
      });
      cancelEditShopping();
      setStatusText("買い物項目を更新しました");
      await loadOverview();
    } finally {
      setSaving(false);
    }
  };

  const inventoryItems = overview?.inventoryItems ?? [];
  const shortages = overview?.shortages ?? [];
  const shoppingItems = overview?.shoppingItems ?? [];
  const purchasedItems = overview?.purchasedItems ?? [];

  return (
    <section className="stack-lg">
      <section className="shop-summary-grid">
        <article className="panel shop-summary-card">
          <p className="label-caption">Shopping</p>
          <h3>{overview?.summary.shoppingCount ?? 0}</h3>
          <p className="status-text">未購入の買い物項目</p>
        </article>
        <article className="panel shop-summary-card">
          <p className="label-caption">Inventory</p>
          <h3>{overview?.summary.inventoryCount ?? 0}</h3>
          <p className="status-text">登録済みの在庫品目</p>
        </article>
        <article className="panel shop-summary-card alert">
          <p className="label-caption">Low Stock</p>
          <h3>{overview?.summary.shortageCount ?? 0}</h3>
          <p className="status-text">補充候補の品目</p>
        </article>
      </section>

      <section className="panel shop-tab-panel">
        <div className="chip-row">
          <button
            className={`chip ${activeTab === "shopping" ? "chip-active" : ""}`}
            onClick={() => setActiveTab("shopping")}
            type="button"
          >
            Shopping List
          </button>
          <button
            className={`chip ${activeTab === "inventory" ? "chip-active" : ""}`}
            onClick={() => setActiveTab("inventory")}
            type="button"
          >
            Inventory
          </button>
        </div>
        <p className={`status-text ${!statusText ? "refresh-status is-empty" : ""}`}>{statusText || "status"}</p>
      </section>

      {loading ? (
        <section className="panel">
          <p className="status-text">読み込み中...</p>
        </section>
      ) : null}

      {!loading && activeTab === "inventory" ? (
        <>
          <section className="grid-2 shop-grid">
            <form className="panel stack-md" onSubmit={submitInventory}>
              <div>
                <p className="eyebrow">ADD ITEM</p>
                <h2>在庫を登録</h2>
              </div>

              <label className="field">
                <span>品目名</span>
                <input
                  required
                  value={inventoryForm.name}
                  onChange={(event) => setInventoryForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>カテゴリ</span>
                  <input
                    value={inventoryForm.category}
                    onChange={(event) => setInventoryForm((current) => ({ ...current, category: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>保管場所</span>
                  <input
                    value={inventoryForm.location}
                    onChange={(event) => setInventoryForm((current) => ({ ...current, location: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>単位</span>
                  <input
                    required
                    value={inventoryForm.unit}
                    onChange={(event) => setInventoryForm((current) => ({ ...current, unit: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>現在数量</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    step="0.1"
                    value={inventoryForm.currentQuantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({ ...current, currentQuantity: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>最低在庫</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    step="0.1"
                    value={inventoryForm.minimumQuantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({ ...current, minimumQuantity: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>補充量の目安</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    step="0.1"
                    value={inventoryForm.preferredBuyQuantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({ ...current, preferredBuyQuantity: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>メモ</span>
                <textarea
                  rows={3}
                  value={inventoryForm.note}
                  onChange={(event) => setInventoryForm((current) => ({ ...current, note: event.target.value }))}
                />
              </label>

              <div className="actions-row">
                <button className="button-primary" disabled={saving} type="submit">
                  在庫を追加
                </button>
              </div>
            </form>

            <section className="panel stack-md">
              <div>
                <p className="eyebrow">LOW STOCK</p>
                <h2>補充候補</h2>
              </div>

              {shortages.length === 0 ? (
                <p className="status-text">不足している品目はありません。</p>
              ) : (
                <div className="shop-shortage-list">
                  {shortages.map((item) => (
                    <article className={`shop-shortage-card ${shortageTone(item)}`} key={item.id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p className="status-text">
                          {formatQuantity(item.currentQuantity)}
                          {item.unit} / 最低 {formatQuantity(item.minimumQuantity)}
                          {item.unit}
                        </p>
                      </div>
                      <div className="actions-row">
                        <button className="button-secondary" onClick={() => addShortageToShopping(item)} type="button">
                          買い物へ追加
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() =>
                            patchInventory(item.id, {
                              currentQuantity: item.currentQuantity + item.preferredBuyQuantity
                            }).then(() => loadOverview())
                          }
                          type="button"
                        >
                          手動で補充済み
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="panel stack-md">
            <div>
              <p className="eyebrow">INVENTORY</p>
              <h2>在庫一覧</h2>
            </div>

            {inventoryItems.length === 0 ? (
              <p className="status-text">まだ在庫品目がありません。</p>
            ) : (
              <div className="shop-item-list">
                {inventoryItems.map((item) => {
                  const isEditing = editingInventoryId === item.id && editingInventoryForm;

                  return (
                    <article className="shop-item-card" key={item.id}>
                      {isEditing ? (
                        <div className="stack-md">
                          <div className="grid-2">
                            <label className="field">
                              <span>品目名</span>
                              <input
                                value={editingInventoryForm.name}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, name: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>単位</span>
                              <input
                                value={editingInventoryForm.unit}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, unit: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="grid-2">
                            <label className="field">
                              <span>カテゴリ</span>
                              <input
                                value={editingInventoryForm.category}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, category: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>保管場所</span>
                              <input
                                value={editingInventoryForm.location}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, location: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="grid-2">
                            <label className="field">
                              <span>現在数量</span>
                              <input
                                inputMode="decimal"
                                type="number"
                                step="0.1"
                                value={editingInventoryForm.currentQuantity}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, currentQuantity: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>最低在庫</span>
                              <input
                                inputMode="decimal"
                                type="number"
                                step="0.1"
                                value={editingInventoryForm.minimumQuantity}
                                onChange={(event) =>
                                  setEditingInventoryForm((current) =>
                                    current ? { ...current, minimumQuantity: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                          </div>

                          <label className="field">
                            <span>補充量の目安</span>
                            <input
                              inputMode="decimal"
                              type="number"
                              step="0.1"
                              value={editingInventoryForm.preferredBuyQuantity}
                              onChange={(event) =>
                                setEditingInventoryForm((current) =>
                                  current ? { ...current, preferredBuyQuantity: event.target.value } : current
                                )
                              }
                            />
                          </label>

                          <label className="field">
                            <span>メモ</span>
                            <textarea
                              rows={3}
                              value={editingInventoryForm.note}
                              onChange={(event) =>
                                setEditingInventoryForm((current) =>
                                  current ? { ...current, note: event.target.value } : current
                                )
                              }
                            />
                          </label>

                          <div className="actions-row">
                            <button className="button-primary" disabled={saving} onClick={() => saveEditInventory(item.id)} type="button">
                              保存
                            </button>
                            <button className="button-secondary" onClick={cancelEditInventory} type="button">
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="shop-item-header">
                            <div>
                              <h3>{item.name}</h3>
                              <p className="status-text">
                                {item.category || "未分類"} / {item.location || "場所未設定"}
                              </p>
                            </div>
                            <span className={`shop-stock-badge ${shortageTone(item)}`}>
                              {formatQuantity(item.currentQuantity)}
                              {item.unit}
                            </span>
                          </div>

                          <div className="shop-item-meta">
                            <span>
                              最低在庫 {formatQuantity(item.minimumQuantity)}
                              {item.unit}
                            </span>
                            <span>
                              補充目安 {formatQuantity(item.preferredBuyQuantity)}
                              {item.unit}
                            </span>
                          </div>

                          {item.note ? <p className="status-text">{item.note}</p> : null}

                          <div className="actions-row">
                            <button
                              className="button-secondary"
                              onClick={() =>
                                patchInventory(item.id, { currentQuantity: Math.max(0, item.currentQuantity - 1) }).then(() =>
                                  loadOverview()
                                )
                              }
                              type="button"
                            >
                              -1
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() =>
                                patchInventory(item.id, { currentQuantity: item.currentQuantity + 1 }).then(() => loadOverview())
                              }
                              type="button"
                            >
                              +1
                            </button>
                            <button className="button-secondary" onClick={() => startEditInventory(item)} type="button">
                              編集
                            </button>
                            <button className="button-secondary" onClick={() => addShortageToShopping(item)} type="button">
                              買い物へ
                            </button>
                            <button className="button-secondary" onClick={() => deleteInventory(item.id)} type="button">
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      {!loading && activeTab === "shopping" ? (
        <>
          <section className="panel stack-md">
            <div>
              <p className="eyebrow">SHOPPING LIST</p>
              <h2>未購入リスト</h2>
            </div>

            {shoppingItems.length === 0 ? (
              <p className="status-text">買い物リストは空です。</p>
            ) : (
              <div className="shop-item-list">
                {shoppingItems.map((item) => {
                  const isEditing = editingShoppingId === item.id && editingShoppingForm;

                  return (
                    <article className="shop-item-card" key={item.id}>
                      {isEditing ? (
                        <div className="stack-md">
                          <div className="grid-2">
                            <label className="field">
                              <span>品目名</span>
                              <input
                                value={editingShoppingForm.name}
                                onChange={(event) =>
                                  setEditingShoppingForm((current) =>
                                    current ? { ...current, name: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>単位</span>
                              <input
                                value={editingShoppingForm.unit}
                                onChange={(event) =>
                                  setEditingShoppingForm((current) =>
                                    current ? { ...current, unit: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="grid-2">
                            <label className="field">
                              <span>数量</span>
                              <input
                                inputMode="decimal"
                                type="number"
                                step="0.1"
                                value={editingShoppingForm.quantity}
                                onChange={(event) =>
                                  setEditingShoppingForm((current) =>
                                    current ? { ...current, quantity: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>店舗候補</span>
                              <input
                                value={editingShoppingForm.store}
                                onChange={(event) =>
                                  setEditingShoppingForm((current) =>
                                    current ? { ...current, store: event.target.value } : current
                                  )
                                }
                              />
                            </label>
                          </div>

                          <label className="field">
                            <span>メモ</span>
                            <textarea
                              rows={3}
                              value={editingShoppingForm.note}
                              onChange={(event) =>
                                setEditingShoppingForm((current) =>
                                  current ? { ...current, note: event.target.value } : current
                                )
                              }
                            />
                          </label>

                          <div className="actions-row">
                            <button className="button-primary" disabled={saving} onClick={() => saveEditShopping(item.id)} type="button">
                              保存
                            </button>
                            <button className="button-secondary" onClick={cancelEditShopping} type="button">
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="shop-item-header">
                            <div>
                              <h3>{item.name}</h3>
                              <p className="status-text">
                                {formatQuantity(item.quantity)}
                                {item.unit}
                                {item.store ? ` / ${item.store}` : ""}
                              </p>
                            </div>
                            <span className="shop-stock-badge neutral">todo</span>
                          </div>

                          {item.note ? <p className="status-text">{item.note}</p> : null}

                          <div className="actions-row">
                            <button
                              className="button-primary"
                              onClick={() => patchShopping(item.id, { status: "done" }).then(() => loadOverview())}
                              type="button"
                            >
                              購入済みにする
                            </button>
                            <button className="button-secondary" onClick={() => startEditShopping(item)} type="button">
                              編集
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() => patchShopping(item.id, { quantity: item.quantity + 1 }).then(() => loadOverview())}
                              type="button"
                            >
                              +1
                            </button>
                            <button className="button-secondary" onClick={() => deleteShopping(item.id)} type="button">
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid-2 shop-grid">
            <form className="panel stack-md" onSubmit={submitShopping}>
              <div>
                <p className="eyebrow">ADD TO LIST</p>
                <h2>買い物リストへ追加</h2>
              </div>

              <label className="field">
                <span>在庫品目から選択</span>
                <select
                  value={shoppingForm.inventoryItemId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const linkedItem = inventoryItems.find((item) => item.id === nextId);
                    setShoppingForm((current) => ({
                      ...current,
                      inventoryItemId: nextId,
                      name: linkedItem?.name ?? current.name,
                      unit: linkedItem?.unit ?? current.unit,
                      quantity: linkedItem ? `${linkedItem.preferredBuyQuantity}` : current.quantity
                    }));
                  }}
                >
                  <option value="">手入力</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>品目名</span>
                  <input
                    required
                    value={shoppingForm.name}
                    onChange={(event) => setShoppingForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>単位</span>
                  <input
                    required
                    value={shoppingForm.unit}
                    onChange={(event) => setShoppingForm((current) => ({ ...current, unit: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>数量</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    step="0.1"
                    required
                    value={shoppingForm.quantity}
                    onChange={(event) => setShoppingForm((current) => ({ ...current, quantity: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>店舗候補</span>
                  <input
                    value={shoppingForm.store}
                    onChange={(event) => setShoppingForm((current) => ({ ...current, store: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                <span>メモ</span>
                <textarea
                  rows={3}
                  value={shoppingForm.note}
                  onChange={(event) => setShoppingForm((current) => ({ ...current, note: event.target.value }))}
                />
              </label>

              <div className="actions-row">
                <button className="button-primary" disabled={saving} type="submit">
                  リストへ追加
                </button>
              </div>
            </form>

            <section className="panel stack-md">
              <div>
                <p className="eyebrow">PURCHASED</p>
                <h2>購入済み</h2>
              </div>

              {purchasedItems.length === 0 ? (
                <p className="status-text">購入済み項目はまだありません。</p>
              ) : (
                <div className="shop-item-list compact">
                  {purchasedItems.slice(0, 6).map((item) => (
                    <article className="shop-item-card compact" key={item.id}>
                      <div className="shop-item-header">
                        <h3>{item.name}</h3>
                        <span className="shop-done-badge">done</span>
                      </div>
                      <p className="status-text">
                        {formatQuantity(item.quantity)}
                        {item.unit}
                        {item.store ? ` / ${item.store}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </>
      ) : null}
    </section>
  );
}
