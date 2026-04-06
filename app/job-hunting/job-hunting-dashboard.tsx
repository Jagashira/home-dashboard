"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { COMPANY_STATUS_OPTIONS, CompanyEntryStatus, JobCompany, JobHuntingDashboardData, JobSite } from "@/lib/job-hunting";

const statusLabels: Record<CompanyEntryStatus, string> = Object.fromEntries(
  COMPANY_STATUS_OPTIONS.map((option) => [option.value, option.label])
) as Record<CompanyEntryStatus, string>;

type SiteForm = {
  name: string;
  purpose: string;
  url: string;
  loginId: string;
  password: string;
  displayOrder: string;
};

type CompanyForm = {
  companyName: string;
  myPageUrl: string;
  loginId: string;
  password: string;
  status: CompanyEntryStatus;
  displayOrder: string;
};

type CredentialTarget =
  | { title: string; loginId: string; password: string }
  | null;

const emptySiteForm: SiteForm = {
  name: "",
  purpose: "",
  url: "",
  loginId: "",
  password: "",
  displayOrder: "0"
};

const emptyCompanyForm: CompanyForm = {
  companyName: "",
  myPageUrl: "",
  loginId: "",
  password: "",
  status: "draft",
  displayOrder: "0"
};

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m13 5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7h15M9 7V4.5h6V7m-7.5 0 .9 12.5h7.2L16.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 6.5h16v11H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m5.5 8 6.5 5 6.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 7.5h6l2 2h9v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3.5 7.5v-1a2 2 0 0 1 2-2H10l1.5 2H20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9 12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function statusTone(status: CompanyEntryStatus) {
  if (status === "draft" || status === "internship_interested") return "draft";
  if (status === "internship_applied" || status === "applied") return "applied";
  if (status === "internship_interview" || status === "es_passed" || status === "interview" || status === "final_interview") return "progress";
  if (status === "internship_offer" || status === "result_waiting") return "waiting";
  if (status === "offer") return "offer";
  return "finished";
}

function isActiveCompany(status: CompanyEntryStatus) {
  return status !== "finished" && status !== "internship_done";
}

function needsAttention(status: CompanyEntryStatus) {
  return status === "draft" || status === "internship_interested" || status === "internship_offer" || status === "applied" || status === "result_waiting";
}

function StatCard({
  label,
  value,
  note
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="job-stat-card">
      <p className="label-caption">{label}</p>
      <h3>{value}</h3>
      <p className="status-text">{note}</p>
    </article>
  );
}

export function JobHuntingDashboard({ data }: { data: JobHuntingDashboardData }) {
  const [sites, setSites] = useState<JobSite[]>(data.sites);
  const [companies, setCompanies] = useState<JobCompany[]>(data.companies);
  const [siteForm, setSiteForm] = useState<SiteForm>(emptySiteForm);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [siteStatus, setSiteStatus] = useState("");
  const [companyStatus, setCompanyStatus] = useState("");
  const [siteSaving, setSiteSaving] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [credentialTarget, setCredentialTarget] = useState<CredentialTarget>(null);
  const [siteEditorOpen, setSiteEditorOpen] = useState(false);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshSites = async () => {
    const response = await fetch("/api/job-hunting/sites", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "サイト一覧更新失敗");
    setSites(payload.sites as JobSite[]);
  };

  const refreshCompanies = async () => {
    const response = await fetch("/api/job-hunting/companies", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "企業一覧更新失敗");
    setCompanies(payload.companies as JobCompany[]);
  };

  const resetSiteForm = () => {
    setEditingSiteId(null);
    setSiteForm(emptySiteForm);
    setSiteEditorOpen(false);
  };

  const resetCompanyForm = () => {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
    setCompanyEditorOpen(false);
  };

  const startCreateSite = () => {
    setEditingSiteId(null);
    setSiteForm({ ...emptySiteForm, displayOrder: String((sites.at(-1)?.displayOrder ?? 0) + 10) });
    setSiteStatus("");
    setSiteEditorOpen(true);
  };

  const startCreateCompany = () => {
    setEditingCompanyId(null);
    setCompanyForm({ ...emptyCompanyForm, displayOrder: String((companies.at(-1)?.displayOrder ?? 0) + 10) });
    setCompanyStatus("");
    setCompanyEditorOpen(true);
  };

  const startEditSite = (site: JobSite) => {
    setEditingSiteId(site.id);
    setSiteStatus("");
    setSiteForm({
      name: site.name,
      purpose: site.purpose,
      url: site.url,
      loginId: site.loginId,
      password: site.password,
      displayOrder: String(site.displayOrder)
    });
    setSiteEditorOpen(true);
  };

  const startEditCompany = (company: JobCompany) => {
    setEditingCompanyId(company.id);
    setCompanyStatus("");
    setCompanyForm({
      companyName: company.companyName,
      myPageUrl: company.myPageUrl,
      loginId: company.loginId,
      password: company.password,
      status: company.status,
      displayOrder: String(company.displayOrder)
    });
    setCompanyEditorOpen(true);
  };

  const submitSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSiteSaving(true);
    setSiteStatus("");
    try {
      const target = editingSiteId ? `/api/job-hunting/sites/${editingSiteId}` : "/api/job-hunting/sites";
      const response = await fetch(target, {
        method: editingSiteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...siteForm, displayOrder: Number(siteForm.displayOrder || "0") })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setSiteStatus(payload.error ?? "保存に失敗しました");
        return;
      }
      await refreshSites();
      setSiteStatus(editingSiteId ? "サイトを更新しました" : "サイトを追加しました");
      resetSiteForm();
    } finally {
      setSiteSaving(false);
    }
  };

  const submitCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCompanySaving(true);
    setCompanyStatus("");
    try {
      const target = editingCompanyId ? `/api/job-hunting/companies/${editingCompanyId}` : "/api/job-hunting/companies";
      const response = await fetch(target, {
        method: editingCompanyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...companyForm, displayOrder: Number(companyForm.displayOrder || "0") })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setCompanyStatus(payload.error ?? "保存に失敗しました");
        return;
      }
      await refreshCompanies();
      setCompanyStatus(editingCompanyId ? "企業を更新しました" : "企業を追加しました");
      resetCompanyForm();
    } finally {
      setCompanySaving(false);
    }
  };

  const deleteSite = async (site: JobSite) => {
    if (!window.confirm(`${site.name} を削除しますか？`)) return;
    setSiteSaving(true);
    setSiteStatus("");
    try {
      const response = await fetch(`/api/job-hunting/sites/${site.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setSiteStatus(payload.error ?? "削除に失敗しました");
        return;
      }
      await refreshSites();
      setSiteStatus("サイトを削除しました");
    } finally {
      setSiteSaving(false);
    }
  };

  const deleteCompany = async (company: JobCompany) => {
    if (!window.confirm(`${company.companyName} を削除しますか？`)) return;
    setCompanySaving(true);
    setCompanyStatus("");
    try {
      const response = await fetch(`/api/job-hunting/companies/${company.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setCompanyStatus(payload.error ?? "削除に失敗しました");
        return;
      }
      await refreshCompanies();
      setCompanyStatus("企業を削除しました");
    } finally {
      setCompanySaving(false);
    }
  };

  const copyCredential = async (label: string, value: string) => {
    if (!value) {
      setCopyStatus(`${label} は未登録です`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} をコピーしました`);
    } catch {
      setCopyStatus(`${label} のコピーに失敗しました`);
    }
  };

  const credentialModal =
    mounted && credentialTarget
      ? createPortal(
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="credentials"
            onClick={(event) => {
              if (event.target === event.currentTarget) setCredentialTarget(null);
            }}
          >
            <section className="modal-card job-credential-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{credentialTarget.title}</h3>
                <button className="button-secondary" type="button" onClick={() => setCredentialTarget(null)}>
                  閉じる
                </button>
              </div>
              <div className="stack-md">
                <div className="job-copy-field">
                  <label className="field">
                    <span>Login ID</span>
                    <input value={credentialTarget.loginId} readOnly />
                  </label>
                  <button className="button-secondary" type="button" onClick={() => copyCredential("Login ID", credentialTarget.loginId)}>
                    コピー
                  </button>
                </div>
                <div className="job-copy-field">
                  <label className="field">
                    <span>Password</span>
                    <input value={credentialTarget.password || "未登録"} readOnly />
                  </label>
                  <button className="button-secondary" type="button" onClick={() => copyCredential("Password", credentialTarget.password)}>
                    コピー
                  </button>
                </div>
                {copyStatus ? <p className="status-text">{copyStatus}</p> : null}
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  const siteEditorModal =
    mounted && siteEditorOpen
      ? createPortal(
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="site editor" onClick={(event) => event.target === event.currentTarget && resetSiteForm()}>
            <section className="modal-card job-site-editor-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingSiteId ? "サイトを編集" : "サイトを追加"}</h3>
                <button className="button-secondary" type="button" onClick={resetSiteForm}>
                  閉じる
                </button>
              </div>
              <form className="job-site-form" onSubmit={submitSite}>
                <div className="job-site-form-grid">
                  <label className="field"><span>サイト名</span><input required value={siteForm.name} onChange={(event) => setSiteForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
                  <label className="field"><span>使用用途</span><input required value={siteForm.purpose} onChange={(event) => setSiteForm((prev) => ({ ...prev, purpose: event.target.value }))} /></label>
                  <label className="field"><span>URL</span><input required value={siteForm.url} onChange={(event) => setSiteForm((prev) => ({ ...prev, url: event.target.value }))} /></label>
                  <label className="field"><span>表示順</span><input inputMode="numeric" value={siteForm.displayOrder} onChange={(event) => setSiteForm((prev) => ({ ...prev, displayOrder: event.target.value }))} /></label>
                  <label className="field"><span>Login ID</span><input value={siteForm.loginId} onChange={(event) => setSiteForm((prev) => ({ ...prev, loginId: event.target.value }))} /></label>
                  <label className="field"><span>Password</span><input value={siteForm.password} onChange={(event) => setSiteForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
                </div>
                <div className="job-site-form-actions">
                  <button className="button-primary" disabled={siteSaving} type="submit">{editingSiteId ? "更新する" : "追加する"}</button>
                  <button className="button-secondary" type="button" onClick={resetSiteForm}>キャンセル</button>
                  {siteStatus ? <p className="status-text">{siteStatus}</p> : null}
                </div>
              </form>
            </section>
          </div>,
          document.body
        )
      : null;

  const companyEditorModal =
    mounted && companyEditorOpen
      ? createPortal(
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="company editor" onClick={(event) => event.target === event.currentTarget && resetCompanyForm()}>
            <section className="modal-card job-site-editor-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingCompanyId ? "企業を編集" : "企業を追加"}</h3>
                <button className="button-secondary" type="button" onClick={resetCompanyForm}>
                  閉じる
                </button>
              </div>
              <form className="job-site-form" onSubmit={submitCompany}>
                <div className="job-site-form-grid">
                  <label className="field"><span>企業名</span><input required value={companyForm.companyName} onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))} /></label>
                  <label className="field"><span>Status</span><select value={companyForm.status} onChange={(event) => setCompanyForm((prev) => ({ ...prev, status: event.target.value as CompanyEntryStatus }))}>{COMPANY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="field"><span>マイページ</span><input required value={companyForm.myPageUrl} onChange={(event) => setCompanyForm((prev) => ({ ...prev, myPageUrl: event.target.value }))} /></label>
                  <label className="field"><span>表示順</span><input inputMode="numeric" value={companyForm.displayOrder} onChange={(event) => setCompanyForm((prev) => ({ ...prev, displayOrder: event.target.value }))} /></label>
                  <label className="field"><span>Login ID</span><input value={companyForm.loginId} onChange={(event) => setCompanyForm((prev) => ({ ...prev, loginId: event.target.value }))} /></label>
                  <label className="field"><span>Password</span><input value={companyForm.password} onChange={(event) => setCompanyForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
                </div>
                <div className="job-site-form-actions">
                  <button className="button-primary" disabled={companySaving} type="submit">{editingCompanyId ? "更新する" : "追加する"}</button>
                  <button className="button-secondary" type="button" onClick={resetCompanyForm}>キャンセル</button>
                  {companyStatus ? <p className="status-text">{companyStatus}</p> : null}
                </div>
              </form>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section className="stack-lg">
        <section className="panel budget-hero job-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <div className="job-hero-grid">
              <div className="stack-sm">
                <p className="label-caption">JOB HUNTING</p>
                <h1 className="budget-title">{data.hero.title}</h1>
                <div className="job-focus-pill">{data.hero.focus}</div>
              </div>
              <div className="job-hero-actions">
                <Link className="button-primary job-action-link" href={data.mail.gmailUrl} target="_blank" rel="noreferrer"><IconMail /><span>Gmail を開く</span></Link>
                <Link className="button-secondary job-action-link" href="/storage"><IconFolder /><span>提出ファイル置き場</span></Link>
                <Link className="button-secondary job-action-link" href="https://jagashira.github.io" target="_blank" rel="noreferrer"><IconSpark /><span>俺のポートフォリオ</span></Link>
              </div>
            </div>
            <section className="job-stat-grid">
              <StatCard label="Active Companies" value={companies.filter((company) => isActiveCompany(company.status)).length} note="進行中の応募先" />
              <StatCard label="Tracked Sites" value={sites.length} note="管理している就活サイト" />
              <StatCard label="Pending Status" value={companies.filter((company) => needsAttention(company.status)).length} note="状態更新が必要な企業" />
              <StatCard label="Mail Presets" value={data.mail.searchPresets.length} note="Gmail 検索プリセット" />
            </section>
          </div>
        </section>

        <section className="job-layout-grid">
          <section className="stack-lg">
            <section className="panel">
              <div className="task-section-heading">
                <div>
                  <p className="label-caption">Companies</p>
                  <h2 className="job-section-title">企業一覧</h2>
                </div>
              </div>
              <div className="job-site-list">
                {companies.map((company) => (
                  <article className="job-site-row job-company-row" key={company.id}>
                    <div className="job-site-row-main">
                      <div className="job-company-row-head">
                        <Link className="job-company-link" href={`/job-hunting/${company.id}`}>
                          {company.companyName}
                        </Link>
                        <span className={`job-status-badge ${statusTone(company.status)}`}>{statusLabels[company.status]}</span>
                      </div>
                    </div>
                    <div className="job-site-row-actions">
                      <Link className="button-secondary" href={company.myPageUrl} target="_blank" rel="noreferrer">マイページ</Link>
                      <button className="icon-button" type="button" onClick={() => { setCopyStatus(""); setCredentialTarget({ title: company.companyName, loginId: company.loginId, password: company.password }); }} aria-label={`${company.companyName} の認証情報を表示`}><IconEye /></button>
                      <button className="icon-button" type="button" onClick={() => startEditCompany(company)} aria-label={`${company.companyName} を編集`}><IconEdit /></button>
                      <button className="icon-button danger" type="button" onClick={() => deleteCompany(company)} aria-label={`${company.companyName} を削除`}><IconTrash /></button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="job-site-footer">
                {companyStatus ? <p className="status-text">{companyStatus}</p> : <span />}
                <button className="button-primary job-add-button" type="button" onClick={startCreateCompany}><IconPlus /><span>追加</span></button>
              </div>
            </section>

            <section className="panel">
              <div className="task-section-heading">
                <div>
                  <p className="label-caption">Used Sites</p>
                  <h2 className="job-section-title">よく使うサイト</h2>
                </div>
              </div>
              <div className="job-site-list">
                {sites.map((site) => (
                  <article className="job-site-row" key={site.id}>
                    <div className="job-site-row-main">
                      <h3>{site.name}</h3>
                      <p>{site.purpose}</p>
                    </div>
                    <div className="job-site-row-actions">
                      <Link className="button-secondary" href={site.url} target="_blank" rel="noreferrer">開く</Link>
                      <button className="icon-button" type="button" onClick={() => { setCopyStatus(""); setCredentialTarget({ title: site.name, loginId: site.loginId, password: site.password }); }} aria-label={`${site.name} の認証情報を表示`}><IconEye /></button>
                      <button className="icon-button" type="button" onClick={() => startEditSite(site)} aria-label={`${site.name} を編集`}><IconEdit /></button>
                      <button className="icon-button danger" type="button" onClick={() => deleteSite(site)} aria-label={`${site.name} を削除`}><IconTrash /></button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="job-site-footer">
                {siteStatus ? <p className="status-text">{siteStatus}</p> : <span />}
                <button className="button-primary job-add-button" type="button" onClick={startCreateSite}><IconPlus /><span>追加</span></button>
              </div>
            </section>
          </section>
        </section>
      </section>
      {credentialModal}
      {siteEditorModal}
      {companyEditorModal}
    </>
  );
}
