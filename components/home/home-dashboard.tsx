"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HomeDashboardData, HomePrimaryCard, HomeQuickStatus, HomeSupportCard } from "@/lib/home-dashboard";
import { OpenAiUsageSnapshot } from "@/lib/openai-usage";

function ToneBadge({ title }: { title: string }) {
  return <span className="home-icon-badge">{title.slice(0, 1)}</span>;
}

function QuickStatusCard({ item, loading = false }: { item: HomeQuickStatus; loading?: boolean }) {
  return (
    <Link className={`home-quick-card tone-${item.tone}`} href={item.href}>
      <div className="home-quick-header">
        <span className="home-card-label">{item.label}</span>
        <ToneBadge title={item.title} />
      </div>
      <div className="home-quick-title-row">
        <h3>{item.title}</h3>
      </div>
      {loading ? (
        <div className="home-skeleton-stack" aria-label="loading">
          <span className="home-skeleton-line home-skeleton-line-lg" />
          <span className="home-skeleton-line home-skeleton-line-sm" />
        </div>
      ) : (
        <>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </>
      )}
    </Link>
  );
}

function PrimaryModuleCard({ item, loading = false }: { item: HomePrimaryCard; loading?: boolean }) {
  return (
    <Link className={`home-module-card variant-${item.variant} tone-${item.tone}`} href={item.href}>
      <div className="home-module-header">
        <div>
          <p className="home-card-label">{item.eyebrow}</p>
          <h3>{item.title}</h3>
        </div>
        <ToneBadge title={item.title} />
      </div>
      {loading ? <div className="home-skeleton-block home-skeleton-copy" aria-label="loading" /> : <p className="home-module-description">{item.description}</p>}
      <div className="home-module-footer">
        <div className="home-module-footer-copy">
          {loading ? (
            <div className="home-skeleton-stack" aria-label="loading">
              <span className="home-skeleton-line home-skeleton-line-md" />
              <span className="home-skeleton-line home-skeleton-line-xs" />
            </div>
          ) : (
            <>
              <strong className="home-module-stat">{item.stat}</strong>
              <span className="home-module-meta">{item.meta}</span>
            </>
          )}
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

type HomeDashboardState = HomeDashboardData;

type OpenAiUsageResponse = {
  ok: boolean;
  usage?: OpenAiUsageSnapshot;
};

function applyOpenAiFallback(dashboard: HomeDashboardState): HomeDashboardState {
  return {
    ...dashboard,
    quickStatuses: dashboard.quickStatuses.map((item) =>
      item.title === "GPT"
        ? {
            ...item,
            value: "—",
            detail: "今日 — · Tok —",
            tone: "neutral"
          }
        : item
    ),
    primaryCards: dashboard.primaryCards.map((item) =>
      item.title === "GPT"
        ? {
            ...item,
            description: "今日 — / Token —",
            stat: "—",
            meta: "OpenAI usage",
            tone: "neutral"
          }
        : item
    )
  };
}

function applyOpenAiUsage(dashboard: HomeDashboardState, usage: OpenAiUsageSnapshot): HomeDashboardState {
  return {
    ...dashboard,
    quickStatuses: dashboard.quickStatuses.map((item) =>
      item.title === "GPT"
        ? {
            ...item,
            value: usage.monthSpendLabel,
            detail: `今日 ${usage.todaySpendLabel} · Tok ${usage.totalTokensLabel}`,
            href: usage.href,
            tone: usage.available ? "green" : "neutral"
          }
        : item
    ),
    primaryCards: dashboard.primaryCards.map((item) =>
      item.title === "GPT"
        ? {
            ...item,
            href: usage.href,
            meta: usage.monthLabel,
            description: `今日 ${usage.todaySpendLabel} / Token ${usage.totalTokensLabel}`,
            stat: usage.monthSpendLabel,
            tone: usage.available ? "green" : "neutral"
          }
        : item
    )
  };
}

export function HomeDashboard({ dashboard }: { dashboard: HomeDashboardData }) {
  const [state, setState] = useState<HomeDashboardState>(dashboard);
  const [openAiLoading, setOpenAiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadOpenAiUsage() {
      try {
        const response = await fetch("/api/openai/usage", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setState((current) => applyOpenAiFallback(current));
          return;
        }
        const json = (await response.json()) as OpenAiUsageResponse;
        if (!json.ok || !json.usage) {
          if (!cancelled) setState((current) => applyOpenAiFallback(current));
          return;
        }
        if (!cancelled) {
          setState((current) =>
            json.usage?.available ? applyOpenAiUsage(current, json.usage as OpenAiUsageSnapshot) : applyOpenAiFallback(current)
          );
        }
      } catch {
        if (!cancelled) setState((current) => applyOpenAiFallback(current));
      } finally {
        if (!cancelled) setOpenAiLoading(false);
      }
    }

    void loadOpenAiUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-dashboard">
      <section className="home-top-grid">
        <article className="home-focus-card">
          <div className="home-focus-head">
            <div>
              <p className="eyebrow">{dashboard.todayLabel}</p>
              <h1>{state.heroTitle}</h1>
            </div>
            <span className="home-date-chip">Today</span>
          </div>

          <p className="home-focus-copy">{state.heroDescription}</p>
          <div className="home-focus-summary">{state.focusSummary}</div>

          <div className="home-focus-metrics">
            {state.focusItems.map((item) => (
              <article className="home-focus-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>

          <div className="home-action-row">
            {state.primaryActions.map((action) => (
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
            <span className="home-panel-note">{state.quickStatuses.length} modules</span>
          </div>
          <div className="home-quick-grid">
            {state.quickStatuses.map((item) => (
              <QuickStatusCard item={item} key={item.title} loading={openAiLoading && item.title === "GPT"} />
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
          {state.primaryCards.map((item) => (
            <PrimaryModuleCard item={item} key={item.title} loading={openAiLoading && item.title === "GPT"} />
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
          {state.supportCards.map((item) => (
            <SupportToolCard item={item} key={item.title} />
          ))}
        </div>
      </section>
    </section>
  );
}
