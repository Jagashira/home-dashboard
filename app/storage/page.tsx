import { getStorageDirectoryState, listStorageDirectories } from "@/lib/storage";
import { StorageCreateFolderForm } from "@/app/storage/storage-create-folder-form";
import { StorageDrivePanel } from "@/app/storage/storage-drive-panel";
import { StorageUploadForm } from "@/app/storage/storage-upload-form";
import { StorageHeaderActions } from "@/app/storage/storage-header-actions";

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

export default async function StoragePage({ searchParams }: StoragePageProps) {
  const params = (await searchParams) ?? {};
  const currentPath = params.path ?? "";
  const storage = await getStorageDirectoryState(currentPath);
  const directories = storage.status === "ready" ? await listStorageDirectories() : [];
  const notice = params.notice?.trim();

  return (
    <main className="mx-auto max-w-[1500px] px-0 py-0 sm:px-4 sm:py-4">
      <div className="overflow-hidden bg-white shadow-[0_14px_50px_rgba(37,52,91,0.12)] sm:rounded-[24px] sm:border sm:border-slate-200">
        <header className="border-b border-slate-200 bg-[linear-gradient(135deg,#1f5fd8_0%,#2f74ef_60%,#1a57cc_100%)] px-4 py-4 text-white sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                Home Server
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-4xl">
                Storage
              </h1>
            </div>

            <StorageHeaderActions
              currentPath={storage.currentPath}
              disabled={storage.status !== "ready"}
              initialNotice={notice ? { message: notice, outcome: params.outcome } : null}
            />
          </div>
        </header>

        <div className="space-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${getStatusTone(storage.status)}`}>
            <p>{storage.message}</p>
          </div>

          {notice ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${getNoticeTone(params.outcome)}`}>
              {notice}
            </div>
          ) : null}

          <StorageDrivePanel
            currentPath={storage.currentPath}
            entries={storage.entries}
            directories={directories}
          />
        </div>
      </div>
    </main>
  );
}
