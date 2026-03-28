import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getStorageDirectoryState } from "@/lib/storage";
import { StorageCreateFolderForm } from "@/app/storage/storage-create-folder-form";
import { StorageDeleteButton } from "@/app/storage/storage-delete-button";
import { StorageUploadForm } from "@/app/storage/storage-upload-form";

export const dynamic = "force-dynamic";

type StoragePageProps = {
  searchParams?: Promise<{
    notice?: string;
    outcome?: string;
    path?: string;
  }>;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

function formatSize(size: number, kind: "file" | "directory") {
  if (kind === "directory") {
    return "-";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let current = size / 1024;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getStatusTone(status: Awaited<ReturnType<typeof getStorageDirectoryState>>["status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "missing-env":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-rose-200 bg-rose-50 text-rose-900";
  }
}

function getNoticeTone(outcome: string | undefined) {
  if (outcome === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-900";
}

function buildStorageHref(currentPath: string) {
  return currentPath ? `/storage?path=${encodeURIComponent(currentPath)}` : "/storage";
}

function buildFileHref(relativePath: string) {
  return `/storage/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

export default async function StoragePage({ searchParams }: StoragePageProps) {
  const params = (await searchParams) ?? {};
  const currentPath = params.path ?? "";
  const storage = await getStorageDirectoryState(currentPath);
  const notice = params.notice?.trim();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Restricted Storage
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Storage</h1>
            <p className="text-sm leading-6 text-slate-600">
              A Google Drive style entry for the home NAS. Browse folders, upload files, create
              folders, and manage direct children inside the configured base directory.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Configured Base Path
              </p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800">
                {storage.configuredBasePath ?? "Not configured"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Current Folder
              </p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800">{storage.currentRelativeLabel}</p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${getStatusTone(storage.status)}`}>
            <p className="text-sm font-medium">{storage.message}</p>
            {storage.status === "missing-env" ? (
              <p className="mt-2 text-sm leading-6">
                Set <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">STORAGE_BASE_PATH</code>{" "}
                to a local directory such as <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">./data/storage-dev</code>{" "}
                during Mac development, or to the NAS mount path on home-server.
              </p>
            ) : null}
          </div>

          {notice ? (
            <div className={`rounded-xl border p-4 text-sm font-medium ${getNoticeTone(params.outcome)}`}>{notice}</div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Folder Navigation</h2>
                <p className="mt-1 text-sm text-slate-600">Browse and organize nested folders like a simple drive view.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {storage.breadcrumbs.map((crumb, index) => (
                  <span key={crumb.path || "root"} className="flex items-center gap-2">
                    <Link href={buildStorageHref(crumb.path)} className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
                      {crumb.label}
                    </Link>
                    {index < storage.breadcrumbs.length - 1 ? <span className="text-slate-400">/</span> : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <StorageCreateFolderForm currentPath={storage.currentPath} disabled={storage.status !== "ready"} />
            </div>
          </div>

          <StorageUploadForm
            currentPath={storage.currentPath}
            disabled={storage.status !== "ready"}
            initialNotice={notice ? { message: notice, outcome: params.outcome } : null}
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Drive View</h2>
              <p className="mt-1 text-sm text-slate-600">Folders open in place, files open in a new tab.</p>
            </div>
            {storage.status === "ready" ? <p className="text-sm text-slate-500">{storage.entries.length} items</p> : null}
          </div>

          {storage.status !== "ready" ? (
            <div className="px-4 py-6 text-sm text-slate-600">Directory contents are unavailable in the current configuration.</div>
          ) : storage.entries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">This folder is currently empty.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {storage.entries.map((entry) => (
                    <tr key={entry.relativePath} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {entry.kind === "directory" ? (
                          <Link href={buildStorageHref(entry.relativePath)} className="inline-flex items-center gap-2 text-slate-900 hover:text-slate-700">
                            <span className="text-base">📁</span>
                            <span>{entry.name}</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <span>{entry.name}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{entry.kind}</td>
                      <td className="px-4 py-3 text-slate-600">{formatSize(entry.size, entry.kind)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTimestamp(entry.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {entry.kind === "file" ? (
                            <Link
                              href={buildFileHref(entry.relativePath)}
                              target="_blank"
                              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                            >
                              View
                            </Link>
                          ) : (
                            <Link
                              href={buildStorageHref(entry.relativePath)}
                              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                            >
                              Open
                            </Link>
                          )}

                          <StorageDeleteButton name={entry.name} relativePath={entry.relativePath} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
