"use client";

import { useState } from "react";
import { COMPANY_STATUS_OPTIONS, CompanyEntryStatus, JobCompanyDetail, JobEssay, JobSubmission, JobTimeline, JobUsefulLink } from "@/lib/job-hunting";

type EssayForm = { question: string; answer: string; submittedAt: string; note: string };
type SubmissionForm = { itemType: string; status: string; submittedAt: string; storagePath: string; note: string };
type TimelineForm = { eventType: string; title: string; eventDate: string; status: string; note: string };
type LinkForm = { label: string; url: string; note: string };
type DetailTab = "essay" | "submission" | "timeline" | "link";
type CompanyForm = { status: CompanyEntryStatus; loginId: string; password: string };

const emptyEssayForm: EssayForm = { question: "", answer: "", submittedAt: "", note: "" };
const emptySubmissionForm: SubmissionForm = { itemType: "", status: "未提出", submittedAt: "", storagePath: "", note: "" };
const emptyTimelineForm: TimelineForm = { eventType: "締切", title: "", eventDate: "", status: "予定", note: "" };
const emptyLinkForm: LinkForm = { label: "", url: "", note: "" };

function formatDate(value: string | null) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toISOString().slice(0, 10);
}

async function jsonRequest(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const payload = await response.json();
  return { response, payload };
}

function countLabel(count: number) {
  return `${count}件`;
}

function IconEye({ closed = false }: { closed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={closed ? "M3.5 3.5l17 17M4.5 12s2.8-5.5 7.5-5.5c1.7 0 3.2.4 4.4 1.1M19.5 12S16.7 17.5 12 17.5c-1.7 0-3.2-.4-4.4-1.1" : "M3.5 12s3.2-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3.2 5.5-8.5 5.5S3.5 12 3.5 12z"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!closed ? <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" /> : null}
    </svg>
  );
}

export function JobCompanyDetailPage({ initialData }: { initialData: JobCompanyDetail }) {
  const [data, setData] = useState(initialData);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    status: initialData.company.status,
    loginId: initialData.company.loginId,
    password: initialData.company.password
  });
  const [activeTab, setActiveTab] = useState<DetailTab>("essay");
  const [showEssayForm, setShowEssayForm] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [companyStatus, setCompanyStatus] = useState("");
  const [credentialStatus, setCredentialStatus] = useState("");
  const [essayForm, setEssayForm] = useState<EssayForm>(emptyEssayForm);
  const [submissionForm, setSubmissionForm] = useState<SubmissionForm>(emptySubmissionForm);
  const [timelineForm, setTimelineForm] = useState<TimelineForm>(emptyTimelineForm);
  const [linkForm, setLinkForm] = useState<LinkForm>(emptyLinkForm);
  const [essayStatus, setEssayStatus] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [timelineStatus, setTimelineStatus] = useState("");
  const [linkStatus, setLinkStatus] = useState("");

  const baseUrl = `/api/job-hunting/companies/${data.company.id}`;
  const tabs: Array<{ key: DetailTab; label: string; caption: string; count: number }> = [
    { key: "essay", label: "ES / 回答文", caption: "設問と提出した回答", count: data.essays.length },
    { key: "submission", label: "提出物", caption: "書類とファイル置き場", count: data.submissions.length },
    { key: "timeline", label: "締切 / 面接 / メモ", caption: "日程と次アクション", count: data.timelines.length },
    { key: "link", label: "使えるリンク", caption: "企業ごとに保存しておくURL", count: data.usefulLinks.length }
  ];

  const saveStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(baseUrl, { method: "PATCH", body: JSON.stringify({ status: companyForm.status }) });
    if (!response.ok || !payload.ok) {
      setCompanyStatus(payload.error ?? "保存失敗");
      return;
    }
    setData((current) => ({
      ...current,
      company: {
        ...current.company,
        status: companyForm.status,
      }
    }));
    setCompanyStatus("Status を更新しました");
  };

  const saveCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(baseUrl, {
      method: "PATCH",
      body: JSON.stringify({ loginId: companyForm.loginId, password: companyForm.password })
    });
    if (!response.ok || !payload.ok) {
      setCredentialStatus(payload.error ?? "保存失敗");
      return;
    }
    setData((current) => ({
      ...current,
      company: {
        ...current.company,
        loginId: companyForm.loginId,
        password: companyForm.password
      }
    }));
    setCredentialStatus("認証情報を更新しました");
    setShowCredentialModal(false);
    setShowPassword(false);
  };

  const addEssay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(`${baseUrl}/essays`, { method: "POST", body: JSON.stringify(essayForm) });
    if (!response.ok || !payload.ok) {
      setEssayStatus(payload.error ?? "保存失敗");
      return;
    }
    setData((current) => ({ ...current, essays: [payload.item as JobEssay, ...current.essays] }));
    setEssayForm(emptyEssayForm);
    setEssayStatus("ES を追加しました");
    setShowEssayForm(false);
  };

  const addSubmission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(`${baseUrl}/submissions`, { method: "POST", body: JSON.stringify(submissionForm) });
    if (!response.ok || !payload.ok) {
      setSubmissionStatus(payload.error ?? "保存失敗");
      return;
    }
    setData((current) => ({ ...current, submissions: [payload.item as JobSubmission, ...current.submissions] }));
    setSubmissionForm(emptySubmissionForm);
    setSubmissionStatus("提出物を追加しました");
    setShowSubmissionForm(false);
  };

  const addTimeline = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(`${baseUrl}/timelines`, { method: "POST", body: JSON.stringify(timelineForm) });
    if (!response.ok || !payload.ok) {
      setTimelineStatus(payload.error ?? "保存失敗");
      return;
    }
    const next = [...data.timelines, payload.item as JobTimeline].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    setData((current) => ({ ...current, timelines: next }));
    setTimelineForm(emptyTimelineForm);
    setTimelineStatus("予定を追加しました");
    setShowTimelineForm(false);
  };

  const addLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { response, payload } = await jsonRequest(`${baseUrl}/links`, { method: "POST", body: JSON.stringify(linkForm) });
    if (!response.ok || !payload.ok) {
      setLinkStatus(payload.error ?? "保存失敗");
      return;
    }
    setData((current) => ({ ...current, usefulLinks: [payload.item as JobUsefulLink, ...current.usefulLinks] }));
    setLinkForm(emptyLinkForm);
    setLinkStatus("リンクを追加しました");
    setShowLinkForm(false);
  };

  const deleteEssay = async (id: string) => {
    if (!window.confirm("この ES を削除しますか？")) return;
    const { response, payload } = await jsonRequest(`${baseUrl}/essays/${id}`, { method: "DELETE" });
    if (!response.ok || !payload.ok) {
      setEssayStatus(payload.error ?? "削除失敗");
      return;
    }
    setData((current) => ({ ...current, essays: current.essays.filter((item) => item.id !== id) }));
  };

  const deleteSubmission = async (id: string) => {
    if (!window.confirm("この提出物を削除しますか？")) return;
    const { response, payload } = await jsonRequest(`${baseUrl}/submissions/${id}`, { method: "DELETE" });
    if (!response.ok || !payload.ok) {
      setSubmissionStatus(payload.error ?? "削除失敗");
      return;
    }
    setData((current) => ({ ...current, submissions: current.submissions.filter((item) => item.id !== id) }));
  };

  const deleteTimeline = async (id: string) => {
    if (!window.confirm("この予定を削除しますか？")) return;
    const { response, payload } = await jsonRequest(`${baseUrl}/timelines/${id}`, { method: "DELETE" });
    if (!response.ok || !payload.ok) {
      setTimelineStatus(payload.error ?? "削除失敗");
      return;
    }
    setData((current) => ({ ...current, timelines: current.timelines.filter((item) => item.id !== id) }));
  };

  const deleteLink = async (id: string) => {
    if (!window.confirm("このリンクを削除しますか？")) return;
    const { response, payload } = await jsonRequest(`${baseUrl}/links/${id}`, { method: "DELETE" });
    if (!response.ok || !payload.ok) {
      setLinkStatus(payload.error ?? "削除失敗");
      return;
    }
    setData((current) => ({ ...current, usefulLinks: current.usefulLinks.filter((item) => item.id !== id) }));
  };

  return (
    <section className="job-company-detail-page stack-lg">
      <section className="panel job-detail-section">
        <div className="task-section-heading">
          <div>
            <p className="label-caption">Company Info</p>
            <h2 className="job-section-title">企業情報</h2>
          </div>
        </div>
        <div className="job-company-info-grid">
          <form className="job-detail-form job-key-card" onSubmit={saveStatus}>
            <label className="field">
              <span>Status</span>
              <select
                value={companyForm.status}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, status: event.target.value as CompanyEntryStatus }))}
              >
                {COMPANY_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="job-inline-form-actions">
              {companyStatus ? <p className="status-text">{companyStatus}</p> : <span />}
              <button className="button-primary" type="submit">保存</button>
            </div>
          </form>

          <article className="job-key-card job-credential-summary">
            <span>Credentials</span>
            <strong>{data.company.loginId || "未登録"}</strong>
            <p>{data.company.password ? "Password は保存済み" : "Password は未登録"}</p>
            <div className="job-inline-form-actions">
              {credentialStatus ? <p className="status-text">{credentialStatus}</p> : <span />}
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setCredentialStatus("");
                  setShowPassword(false);
                  setShowCredentialModal(true);
                }}
              >
                編集
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="job-detail-section panel">
        <div className="task-section-heading">
          <div>
            <p className="label-caption">Detail</p>
            <h2 className="job-section-title">企業ごとの管理</h2>
          </div>
        </div>

        <div className="job-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "job-tab is-active" : "job-tab"}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              <strong>{tab.label}</strong>
              <p>{tab.caption}</p>
              <span>{countLabel(tab.count)}</span>
            </button>
          ))}
        </div>

        {activeTab === "essay" ? (
          <div className="job-tab-panel">
            <div className="job-tab-toolbar">
              <div className="job-tab-toolbar-copy">
                <strong>登録済み {countLabel(data.essays.length)}</strong>
                <p>質問と回答を見返しながら、必要なときだけ追記する。</p>
              </div>
              <button className="button-primary" type="button" onClick={() => setShowEssayForm((current) => !current)}>
                {showEssayForm ? "入力を閉じる" : "ES を追加"}
              </button>
            </div>
            {essayStatus ? <p className="status-text">{essayStatus}</p> : null}
            {showEssayForm ? (
              <form className="job-detail-form" onSubmit={addEssay}>
                <label className="field">
                  <span>質問</span>
                  <textarea rows={3} required value={essayForm.question} onChange={(event) => setEssayForm((prev) => ({ ...prev, question: event.target.value }))} />
                </label>
                <label className="field">
                  <span>回答</span>
                  <textarea rows={5} required value={essayForm.answer} onChange={(event) => setEssayForm((prev) => ({ ...prev, answer: event.target.value }))} />
                </label>
                <div className="job-detail-form-grid">
                  <label className="field">
                    <span>提出日</span>
                    <input type="date" value={essayForm.submittedAt} onChange={(event) => setEssayForm((prev) => ({ ...prev, submittedAt: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>メモ</span>
                    <input value={essayForm.note} onChange={(event) => setEssayForm((prev) => ({ ...prev, note: event.target.value }))} />
                  </label>
                </div>
                <button className="button-primary" type="submit">登録する</button>
              </form>
            ) : null}
            <div className="job-entry-list">
              {data.essays.length === 0 ? <div className="job-plan-empty">まだ登録なし</div> : null}
              {data.essays.map((essay) => (
                <article className="job-entry-card" key={essay.id}>
                  <div className="job-entry-head">
                    <strong>{essay.question}</strong>
                    <button className="icon-button danger" type="button" onClick={() => deleteEssay(essay.id)}>×</button>
                  </div>
                  <div className="job-entry-meta-row">
                    <span className="job-entry-chip">提出日 {formatDate(essay.submittedAt)}</span>
                    {essay.note ? <span className="job-entry-chip subtle">{essay.note}</span> : null}
                  </div>
                  <p className="job-entry-body">{essay.answer}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "submission" ? (
          <div className="job-tab-panel">
            <div className="job-tab-toolbar">
              <div className="job-tab-toolbar-copy">
                <strong>登録済み {countLabel(data.submissions.length)}</strong>
                <p>提出済みと未提出を混ぜずに、保存場所まで一覧で確認する。</p>
              </div>
              <button className="button-primary" type="button" onClick={() => setShowSubmissionForm((current) => !current)}>
                {showSubmissionForm ? "入力を閉じる" : "提出物を追加"}
              </button>
            </div>
            {submissionStatus ? <p className="status-text">{submissionStatus}</p> : null}
            {showSubmissionForm ? (
              <form className="job-detail-form" onSubmit={addSubmission}>
                <div className="job-detail-form-grid">
                  <label className="field">
                    <span>種類</span>
                    <input required value={submissionForm.itemType} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, itemType: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>状態</span>
                    <input required value={submissionForm.status} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, status: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>提出日</span>
                    <input type="date" value={submissionForm.submittedAt} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, submittedAt: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>保存場所</span>
                    <input value={submissionForm.storagePath} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, storagePath: event.target.value }))} />
                  </label>
                </div>
                <label className="field">
                  <span>メモ</span>
                  <input value={submissionForm.note} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, note: event.target.value }))} />
                </label>
                <button className="button-primary" type="submit">登録する</button>
              </form>
            ) : null}
            <div className="job-entry-list">
              {data.submissions.length === 0 ? <div className="job-plan-empty">まだ登録なし</div> : null}
              {data.submissions.map((item) => (
                <article className="job-entry-card" key={item.id}>
                  <div className="job-entry-head">
                    <strong>{item.itemType}</strong>
                    <button className="icon-button danger" type="button" onClick={() => deleteSubmission(item.id)}>×</button>
                  </div>
                  <div className="job-entry-meta-row">
                    <span className="job-entry-chip">{item.status}</span>
                    <span className="job-entry-chip">提出日 {formatDate(item.submittedAt)}</span>
                    {item.storagePath ? <span className="job-entry-chip subtle">保存場所 {item.storagePath}</span> : null}
                  </div>
                  {item.note ? <p className="job-entry-body">{item.note}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "timeline" ? (
          <div className="job-tab-panel">
            <div className="job-tab-toolbar">
              <div className="job-tab-toolbar-copy">
                <strong>登録済み {countLabel(data.timelines.length)}</strong>
                <p>締切と面接予定を同じ場所で確認して、次アクションを逃さない。</p>
              </div>
              <button className="button-primary" type="button" onClick={() => setShowTimelineForm((current) => !current)}>
                {showTimelineForm ? "入力を閉じる" : "予定を追加"}
              </button>
            </div>
            {timelineStatus ? <p className="status-text">{timelineStatus}</p> : null}
            {showTimelineForm ? (
              <form className="job-detail-form" onSubmit={addTimeline}>
                <div className="job-detail-form-grid">
                  <label className="field">
                    <span>種別</span>
                    <input required value={timelineForm.eventType} onChange={(event) => setTimelineForm((prev) => ({ ...prev, eventType: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>タイトル</span>
                    <input required value={timelineForm.title} onChange={(event) => setTimelineForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>日付</span>
                    <input type="date" required value={timelineForm.eventDate} onChange={(event) => setTimelineForm((prev) => ({ ...prev, eventDate: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>状態</span>
                    <input required value={timelineForm.status} onChange={(event) => setTimelineForm((prev) => ({ ...prev, status: event.target.value }))} />
                  </label>
                </div>
                <label className="field">
                  <span>メモ</span>
                  <input value={timelineForm.note} onChange={(event) => setTimelineForm((prev) => ({ ...prev, note: event.target.value }))} />
                </label>
                <button className="button-primary" type="submit">登録する</button>
              </form>
            ) : null}
            <div className="job-entry-list">
              {data.timelines.length === 0 ? <div className="job-plan-empty">まだ登録なし</div> : null}
              {data.timelines.map((item) => (
                <article className="job-entry-card" key={item.id}>
                  <div className="job-entry-head">
                    <strong>{item.title}</strong>
                    <button className="icon-button danger" type="button" onClick={() => deleteTimeline(item.id)}>×</button>
                  </div>
                  <div className="job-entry-meta-row">
                    <span className="job-entry-chip">{item.eventType}</span>
                    <span className="job-entry-chip">{item.status}</span>
                    <span className="job-entry-chip">日付 {formatDate(item.eventDate)}</span>
                  </div>
                  {item.note ? <p className="job-entry-body">{item.note}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "link" ? (
          <div className="job-tab-panel">
            <div className="job-tab-toolbar">
              <div className="job-tab-toolbar-copy">
                <strong>登録済み {countLabel(data.usefulLinks.length)}</strong>
                <p>あとで使う企業別の URL をまとめて、探し直さなくていい状態にする。</p>
              </div>
              <button className="button-primary" type="button" onClick={() => setShowLinkForm((current) => !current)}>
                {showLinkForm ? "入力を閉じる" : "リンクを追加"}
              </button>
            </div>
            {linkStatus ? <p className="status-text">{linkStatus}</p> : null}
            {showLinkForm ? (
              <form className="job-detail-form" onSubmit={addLink}>
                <div className="job-detail-form-grid">
                  <label className="field">
                    <span>リンク名</span>
                    <input required value={linkForm.label} onChange={(event) => setLinkForm((prev) => ({ ...prev, label: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>URL</span>
                    <input required value={linkForm.url} onChange={(event) => setLinkForm((prev) => ({ ...prev, url: event.target.value }))} />
                  </label>
                </div>
                <label className="field">
                  <span>メモ</span>
                  <input value={linkForm.note} onChange={(event) => setLinkForm((prev) => ({ ...prev, note: event.target.value }))} />
                </label>
                <button className="button-primary" type="submit">登録する</button>
              </form>
            ) : null}
            <div className="job-entry-list">
              {data.usefulLinks.length === 0 ? <div className="job-plan-empty">まだ登録なし</div> : null}
              {data.usefulLinks.map((item) => (
                <article className="job-entry-card" key={item.id}>
                  <div className="job-entry-head">
                    <strong>{item.label}</strong>
                    <button className="icon-button danger" type="button" onClick={() => deleteLink(item.id)}>×</button>
                  </div>
                  <a className="job-entry-link" href={item.url} target="_blank" rel="noreferrer">
                    {item.url}
                  </a>
                  {item.note ? <p className="job-entry-body">{item.note}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {showCredentialModal ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="credential editor"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCredentialModal(false);
              setShowPassword(false);
            }
          }}
        >
          <section className="modal-card job-credential-modal" onClick={(event) => event.stopPropagation()}>
            <div className="task-section-heading">
              <div>
                <p className="label-caption">Credentials</p>
                <h2 className="job-section-title">認証情報を編集</h2>
              </div>
            </div>
            <form className="job-detail-form" onSubmit={saveCredentials}>
              <label className="field">
                <span>Login ID</span>
                <input
                  value={companyForm.loginId}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, loginId: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <div className="job-password-row">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={companyForm.password}
                    onChange={(event) => setCompanyForm((prev) => ({ ...prev, password: event.target.value }))}
                  />
                  <button className="icon-button" type="button" aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setShowPassword((current) => !current)}>
                    <IconEye closed={!showPassword} />
                  </button>
                </div>
              </label>
              <div className="job-form-actions">
                {credentialStatus ? <p className="status-text">{credentialStatus}</p> : <span />}
                <div className="job-modal-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => {
                      setShowCredentialModal(false);
                      setShowPassword(false);
                    }}
                  >
                    閉じる
                  </button>
                  <button className="button-primary" type="submit">保存する</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
