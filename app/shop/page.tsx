import { ShopManager } from "./shop-manager";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">SHOP + INVENTORY</p>
          <h1 className="budget-title">Inventory and Shopping</h1>
          <p className="status-text">
            家庭内の在庫を管理し、不足したものをそのまま買い物リストへ流せる最小構成です。
          </p>
        </div>
      </section>

      <ShopManager />
    </section>
  );
}
