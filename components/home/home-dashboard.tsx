import Link from "next/link";
import { HomeDashboardData, HomePrimaryCard, HomeQuickStatus, HomeSupportCard } from "@/lib/home-dashboard";

function ToneBadge({ title }: { title: string }) {
  return <span className="home-icon-badge">{title.slice(0, 1)}</span>;
}

function QuickStatusCard({ item }: { item: HomeQuickStatus }) {
  return (
    <Link className={`home-quick-card tone-${item.tone}`} href={item.href}>
      <div className="home-quick-header">
        <span className="home-card-label">{item.label}</span>
        <ToneBadge title={item.title} />
      </div>
      <div className="home-quick-title-row">
        <h3>{item.title}</h3>
      </div>
      <strong>{item.value}</strong>
      <p>{item.detail}</p>
    </Link>
  );
}

function PrimaryModuleCard({ item }: { item: HomePrimaryCard }) {
  return (
    <Link className={`home-module-card variant-${item.variant} tone-${item.tone}`} href={item.href}>
      <div className="home-module-header">
        <div>
          <p className="home-card-label">{item.eyebrow}</p>
          <h3>{item.title}</h3>
        </div>
        <ToneBadge title={item.title} />
      </div>
      <p className="home-module-description">{item.description}</p>
      <div className="home-module-footer">
        <div className="home-module-footer-copy">
          <strong className="home-module-stat">{item.stat}</strong>
          <span className="home-module-meta">{item.meta}</span>
        </div>
        <span className="home-inline-link">開く</span>
      </div>
    </Link>
  );
}

function SupportToolCard({ item }: { item: HomeSupportCard }) {
  return (
    <Link className="home-support-card" href={item.href}>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <span className="home-inline-link">開く</span>
    </Link>
  );
}

export function HomeDashboard({ dashboard }: { dashboard: HomeDashboardData }) {
  return (
    <section className="home-dashboard">
      <section className="home-top-grid">
        <article className="home-focus-card">
          <div className="home-focus-head">
            <div>
              <p className="eyebrow">{dashboard.todayLabel}</p>
              <h1>{dashboard.heroTitle}</h1>
            </div>
            <span className="home-date-chip">Today</span>
          </div>

          <p className="home-focus-copy">{dashboard.heroDescription}</p>
          <div className="home-focus-summary">{dashboard.focusSummary}</div>

          <div className="home-focus-metrics">
            {dashboard.focusItems.map((item) => (
              <article className="home-focus-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>

          <div className="home-action-row">
            {dashboard.primaryActions.map((action) => (
              <Link
                className={action.kind === "primary" ? "button-primary" : "button-secondary"}
                href={action.href}
                key={action.label}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </article>

        <aside className="home-status-panel">
          <div className="home-section-head">
            <div>
              <p className="eyebrow">Quick Status</p>
              <h2>いまの状態</h2>
            </div>
            <span className="home-panel-note">4 modules</span>
          </div>
          <div className="home-quick-grid">
            {dashboard.quickStatuses.map((item) => (
              <QuickStatusCard item={item} key={item.title} />
            ))}
          </div>
        </aside>
      </section>

      <section className="home-block">
        <div className="home-section-head">
          <div>
            <p className="eyebrow">Main</p>
            <h2>毎日触る画面</h2>
          </div>
        </div>
        <div className="home-module-grid">
          {dashboard.primaryCards.map((item) => (
            <PrimaryModuleCard item={item} key={item.title} />
          ))}
        </div>
      </section>

      <section className="home-block">
        <div className="home-section-head">
          <div>
            <p className="eyebrow">Support / Tools</p>
            <h2>管理と補助機能</h2>
          </div>
        </div>
        <div className="home-support-grid">
          {dashboard.supportCards.map((item) => (
            <SupportToolCard item={item} key={item.title} />
          ))}
        </div>
      </section>
    </section>
  );
}
