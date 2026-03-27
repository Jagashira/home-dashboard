import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { deleteStorageEntry, getStorageDirectoryState, uploadStorageFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type StoragePageProps = {
  searchParams?: Promise<{
    notice?: string;
    outcome?: string;
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

function buildNoticePath(outcome: "success" | "error", notice: string) {
  const params = new URLSearchParams({ outcome, notice });
  return `/storage?${params.toString()}`;
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (code === "EROFS") {
      return "The storage directory is mounted read-only, so uploads and deletes are currently disabled.";
    }

    if (code === "EACCES" || code === "EPERM") {
      return "The app does not have permission to modify the storage directory.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

async function uploadStorageFileAction(formData: FormData) {
  "use server";

  let destination = buildNoticePath("error", "Choose a file to upload.");

  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      redirect(destination);
    }

    const result = await uploadStorageFile(file);
    revalidatePath("/storage");
    destination = buildNoticePath("success", result.message);
  } catch (error) {
    const message = getActionErrorMessage(error, "Failed to upload the file.");
    destination = buildNoticePath("error", message);
  }

  redirect(destination);
}

async function deleteStorageEntryAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  let destination = buildNoticePath("error", "Failed to delete the selected entry.");

  try {
    const result = await deleteStorageEntry(name);
    revalidatePath("/storage");
    destination = buildNoticePath("success", result.message);
  } catch (error) {
    const message = getActionErrorMessage(error, "Failed to delete the selected entry.");
    destination = buildNoticePath("error", message);
  }

  redirect(destination);
}

function getNoticeTone(outcome: string | undefined) {
  if (outcome === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-900";
}

export default async function StoragePage({ searchParams }: StoragePageProps) {
  const storage = await getStorageDirectoryState();
  const params = (await searchParams) ?? {};
  const notice = params.notice?.trim();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Restricted Storage
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Storage</h1>
            <p className="text-sm leading-6 text-slate-600">
              This page reads the NAS or storage base directory through the server, and is intended
              to be exposed only behind nginx access control.
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
                Resolved Directory
              </p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800">
                {storage.resolvedBasePath ?? "-"}
              </p>
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
            <div className={`rounded-xl border p-4 text-sm font-medium ${getNoticeTone(params.outcome)}`}>
              {notice}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Upload File</h2>
              <p className="text-sm leading-6 text-slate-600">
                Uploads are stored directly under the configured base directory. Existing file names
                are protected from overwrite.
              </p>
            </div>

            <form action={uploadStorageFileAction} className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="file"
                name="file"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
                disabled={storage.status !== "ready"}
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={storage.status !== "ready"}
              >
                Upload
              </button>
            </form>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Directory Listing</h2>
              <p className="mt-1 text-sm text-slate-600">Direct children of the configured base directory only.</p>
            </div>
            {storage.status === "ready" ? (
              <p className="text-sm text-slate-500">{storage.entries.length} items</p>
            ) : null}
          </div>

          {storage.status !== "ready" ? (
            <div className="px-4 py-6 text-sm text-slate-600">Directory contents are unavailable in the current configuration.</div>
          ) : storage.entries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">The configured directory exists, but it is currently empty.</div>
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
                    <tr key={entry.name} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">{entry.name}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.kind}</td>
                      <td className="px-4 py-3 text-slate-600">{formatSize(entry.size, entry.kind)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTimestamp(entry.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {entry.kind === "file" ? (
                            <Link
                              href={`/storage/files/${encodeURIComponent(entry.name)}`}
                              target="_blank"
                              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
                              Directory
                            </span>
                          )}

                          <form action={deleteStorageEntryAction}>
                            <input type="hidden" name="name" value={entry.name} />
                            <button
                              type="submit"
                              className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700"
                            >
                              Delete
                            </button>
                          </form>
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
