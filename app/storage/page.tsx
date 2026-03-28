import Link from "next/link";
import { getStorageDirectoryState, listStorageDirectories } from "@/lib/storage";
import { StorageCreateFolderForm } from "@/app/storage/storage-create-folder-form";
import { StorageDrivePanel } from "@/app/storage/storage-drive-panel";
import { StorageUploadForm } from "@/app/storage/storage-upload-form";

export const dynamic = "force-dynamic";

type StoragePageProps = {
  searchParams?: Promise<{
    notice?: string;
    outcome?: string;
    path?: string;
  }>;
};

function getStatusTone(status: Awaited<ReturnType<typeof getStorageDirectoryState>>["status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-200/80 bg-emerald-50/90 text-emerald-950";
    case "missing-env":
      return "border-amber-200/80 bg-amber-50/90 text-amber-950";
    default:
      return "border-rose-200/80 bg-rose-50/90 text-rose-950";
  }
}

function getNoticeTone(outcome: string | undefined) {
  if (outcome === "success") {
    return "border-emerald-200/80 bg-emerald-50/90 text-emerald-950";
  }

  return "border-rose-200/80 bg-rose-50/90 text-rose-950";
}

function buildStorageHref(currentPath: string) {
  return currentPath ? `/storage?path=${encodeURIComponent(currentPath)}` : "/storage";
}

function FolderMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    </svg>
  );
}

function UploadMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M12 3l4.5 4.5-1.4 1.4-2.1-2.1V15h-2V6.8L8.9 8.9 7.5 7.5zm-7 13h14v4H5z" />
    </svg>
  );
}

function PlusMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
    </svg>
  );
}

export default async function StoragePage({ searchParams }: StoragePageProps) {
  const params = (await searchParams) ?? {};
  const currentPath = params.path ?? "";
  const storage = await getStorageDirectoryState(currentPath);
  const directories = storage.status === "ready" ? await listStorageDirectories() : [];
  const notice = params.notice?.trim();
  const topLevelDirectories = directories.filter((directory) => directory.path && !directory.path.includes("/"));

  return (
    <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="overflow-hidden rounded-[34px] border border-white/45 bg-white/65 shadow-[0_30px_80px_rgba(37,55,105,0.12)] backdrop-blur">
        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#1f5fd8_0%,#2f78ff_48%,#1653cb_100%)] px-5 py-5 text-white sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute left-10 top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-18 w-18 items-center justify-center rounded-[24px] border border-white/20 bg-white/12 text-white shadow-lg shadow-blue-950/20">
                  <FolderMark />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/72">
                    Home Server
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">
                    Storage
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/84 sm:text-base">
                    A familiar drive-style gateway for the NAS. Browse folders, drag files in,
                    preview media, and keep everything organized behind nginx access control.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-white/82">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  Current folder: {storage.currentRelativeLabel}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  {storage.entries.length} items
                </span>
                {storage.configuredBasePath ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs sm:text-sm">
                    {storage.configuredBasePath}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-[28px] border border-white/18 bg-white/10 p-4 shadow-lg shadow-blue-950/10 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-white">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5">
                  <UploadMark />
                  Upload
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5">
                  <PlusMark />
                  New Folder
                </span>
              </div>

              <StorageUploadForm
                currentPath={storage.currentPath}
                disabled={storage.status !== "ready"}
                compact
                initialNotice={notice ? { message: notice, outcome: params.outcome } : null}
              />

              <StorageCreateFolderForm currentPath={storage.currentPath} disabled={storage.status !== "ready"} compact />
            </div>
          </div>
        </section>

        <div className="space-y-4 bg-[linear-gradient(180deg,rgba(247,249,255,0.9),rgba(255,255,255,0.88))] px-3 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {storage.breadcrumbs.map((crumb, index) => (
                <span key={crumb.path || "root"} className="flex items-center gap-2">
                  <Link
                    href={buildStorageHref(crumb.path)}
                    className="rounded-full px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white hover:no-underline"
                  >
                    {crumb.label}
                  </Link>
                  {index < storage.breadcrumbs.length - 1 ? (
                    <span className="text-slate-400">/</span>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Restricted Entry</span>
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">NAS Browser</span>
            </div>
          </div>

          <div className={`rounded-[24px] border px-4 py-3 text-sm font-medium shadow-sm ${getStatusTone(storage.status)}`}>
            <p>{storage.message}</p>
            {storage.status === "missing-env" ? (
              <p className="mt-2 leading-6">
                Set <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">STORAGE_BASE_PATH</code>{" "}
                to a local directory such as <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">./data/storage-dev</code>{" "}
                during Mac development, or to the NAS mount path on home-server.
              </p>
            ) : null}
          </div>

          {notice ? (
            <div className={`rounded-[24px] border px-4 py-3 text-sm font-medium shadow-sm ${getNoticeTone(params.outcome)}`}>
              {notice}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_16px_40px_rgba(27,39,79,0.08)] backdrop-blur">
              <div className="border-b border-slate-200/80 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Libraries
                </p>
              </div>

              <nav className="space-y-1 px-3 py-3">
                <Link
                  href="/storage"
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition hover:no-underline ${
                    storage.currentPath === ""
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-blue-600">
                    <FolderMark />
                  </span>
                  <span>Storage</span>
                </Link>

                {topLevelDirectories.map((directory) => {
                  const isActive =
                    storage.currentPath === directory.path ||
                    storage.currentPath.startsWith(`${directory.path}/`);

                  return (
                    <Link
                      key={directory.path}
                      href={buildStorageHref(directory.path)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition hover:no-underline ${
                        isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className={isActive ? "text-blue-600" : "text-slate-400"}>
                        <FolderMark />
                      </span>
                      <span>{directory.label.replace(/^\//, "")}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-slate-200/80 px-5 py-4 text-xs leading-6 text-slate-500">
                <p>Use the main view to rename, move, preview, and drag items between folders.</p>
              </div>
            </aside>

            <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/92 shadow-[0_16px_40px_rgba(27,39,79,0.08)] backdrop-blur">
              <StorageDrivePanel currentPath={storage.currentPath} entries={storage.entries} directories={directories} />
            </section>
          </div>

          <footer className="flex flex-col gap-3 rounded-[24px] border border-slate-200/80 bg-white/86 px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">{storage.entries.length} items</span>
              <span className="text-slate-300">•</span>
              <span>Folder {storage.currentRelativeLabel}</span>
            </div>
            <div className="max-w-full truncate font-mono text-xs text-slate-500 sm:text-sm">
              Base path: {storage.configuredBasePath ?? "Not configured"}
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
