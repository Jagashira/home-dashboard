"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorageDirectoryOption, StorageItem } from "@/lib/storage";

type StorageDrivePanelProps = {
  currentPath: string;
  entries: StorageItem[];
  directories: StorageDirectoryOption[];
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

function buildStorageHref(currentPath: string) {
  return currentPath ? `/storage?path=${encodeURIComponent(currentPath)}` : "/storage";
}

function buildFileHref(relativePath: string) {
  return `/storage/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function getPreviewKind(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return "image";
  }

  if (["mp4", "webm", "mov", "ogv"].includes(extension)) {
    return "video";
  }

  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(extension)) {
    return "audio";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (["txt", "md", "json", "csv"].includes(extension)) {
    return "text";
  }

  return "generic";
}

export function StorageDrivePanel({ currentPath, entries, directories }: StorageDrivePanelProps) {
  const router = useRouter();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [moveTarget, setMoveTarget] = useState(currentPath);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const selectedItems = useMemo(
    () => entries.filter((entry) => selectedPaths.includes(entry.relativePath)),
    [entries, selectedPaths]
  );
  const previewItem = entries.find((entry) => entry.relativePath === previewPath) ?? selectedItems[0] ?? null;
  const allSelected = entries.length > 0 && selectedPaths.length === entries.length;

  function toggleSelection(relativePath: string) {
    setSelectedPaths((current) =>
      current.includes(relativePath) ? current.filter((item) => item !== relativePath) : [...current, relativePath]
    );
  }

  function toggleSelectAll() {
    setSelectedPaths(allSelected ? [] : entries.map((entry) => entry.relativePath));
  }

  async function postForm(url: string, formData: FormData) {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        "x-storage-client": "1"
      }
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "Request failed.");
    }
  }

  async function handleDeleteSelected() {
    if (!selectedItems.length || isWorking) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedItems.length} selected item(s)?`);
    if (!confirmed) {
      return;
    }

    setIsWorking(true);

    try {
      for (const item of selectedItems) {
        const formData = new FormData();
        formData.append("path", item.relativePath);
        await postForm("/storage/delete", formData);
      }

      setSelectedPaths([]);
      setPreviewPath(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRenameSelected() {
    if (selectedItems.length !== 1 || isWorking) {
      return;
    }

    const current = selectedItems[0];
    const nextName = window.prompt("Rename item", current.name)?.trim();
    if (!nextName || nextName === current.name) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("path", current.relativePath);
      formData.append("name", nextName);
      await postForm("/storage/rename", formData);

      setSelectedPaths([]);
      setPreviewPath(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename the selected item.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMoveSelected() {
    if (!selectedItems.length || isWorking) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("targetPath", moveTarget);
      selectedItems.forEach((item) => formData.append("paths", item.relativePath));
      await postForm("/storage/move", formData);

      setSelectedPaths([]);
      setPreviewPath(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  function getDraggedPaths(relativePath: string) {
    return selectedPaths.includes(relativePath) ? selectedPaths : [relativePath];
  }

  async function handleDropOnFolder(targetRelativePath: string, draggedPaths: string[]) {
    if (!draggedPaths.length || isWorking) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("targetPath", targetRelativePath);
      draggedPaths.forEach((item) => formData.append("paths", item));
      await postForm("/storage/move", formData);

      setSelectedPaths([]);
      setPreviewPath(null);
      setDropTargetPath(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Drive View</h2>
              <p className="mt-1 text-sm text-slate-600">Folders open in place, files open in a new tab.</p>
            </div>
            <p className="text-sm text-slate-500">{entries.length} items</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-600">{selectedItems.length} selected</div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                type="button"
                onClick={handleRenameSelected}
                disabled={selectedItems.length !== 1 || isWorking}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rename
              </button>
              <select
                value={moveTarget}
                onChange={(event) => setMoveTarget(event.target.value)}
                disabled={!selectedItems.length || isWorking}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {directories.map((directory) => (
                  <option key={directory.path || "root"} value={directory.path}>
                    {directory.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleMoveSelected}
                disabled={!selectedItems.length || isWorking}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Move
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!selectedItems.length || isWorking}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">This folder is currently empty.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.map((entry) => (
                  <tr
                    key={entry.relativePath}
                    draggable
                    onDragStart={(event) => {
                      const draggedPaths = getDraggedPaths(entry.relativePath);
                      event.dataTransfer.setData("application/json", JSON.stringify(draggedPaths));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDropTargetPath(null)}
                    onDragOver={(event) => {
                      if (entry.kind !== "directory") {
                        return;
                      }

                      event.preventDefault();
                      if (dropTargetPath !== entry.relativePath) {
                        setDropTargetPath(entry.relativePath);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }

                      if (dropTargetPath === entry.relativePath) {
                        setDropTargetPath(null);
                      }
                    }}
                    onDrop={(event) => {
                      if (entry.kind !== "directory") {
                        return;
                      }

                      event.preventDefault();
                      const raw = event.dataTransfer.getData("application/json");
                      const draggedPaths = raw ? (JSON.parse(raw) as string[]) : [];
                      void handleDropOnFolder(entry.relativePath, draggedPaths);
                    }}
                    className={[
                      selectedPaths.includes(entry.relativePath) ? "bg-slate-50" : "",
                      dropTargetPath === entry.relativePath ? "ring-2 ring-inset ring-slate-400" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPaths.includes(entry.relativePath)}
                        onChange={() => toggleSelection(entry.relativePath)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => setPreviewPath(entry.relativePath)}
                        className="inline-flex items-center gap-2 text-left hover:text-slate-700"
                      >
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {entry.kind === "directory" ? "DIR" : "FILE"}
                        </span>
                        <span>{entry.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{entry.kind}</td>
                    <td className="px-4 py-3 text-slate-600">{formatSize(entry.size, entry.kind)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTimestamp(entry.updatedAt)}</td>
                    <td className="px-4 py-3">
                      {entry.kind === "directory" ? (
                        <Link
                          href={buildStorageHref(entry.relativePath)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700"
                        >
                          Open
                        </Link>
                      ) : (
                        <Link
                          href={buildFileHref(entry.relativePath)}
                          target="_blank"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
        {previewItem ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{previewItem.name}</p>
              <p className="mt-1 text-sm text-slate-600">{previewItem.kind}</p>
              <p className="mt-1 text-sm text-slate-600">Updated {formatTimestamp(previewItem.updatedAt)}</p>
            </div>

            {previewItem.kind === "directory" ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                This is a folder. Open it to browse its contents.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {(() => {
                  const previewKind = getPreviewKind(previewItem.name);
                  const fileHref = buildFileHref(previewItem.relativePath);

                  if (previewKind === "image") {
                    return <img src={fileHref} alt={previewItem.name} className="max-h-80 w-full object-contain bg-slate-100" />;
                  }

                  if (previewKind === "video") {
                    return <video src={fileHref} controls className="max-h-80 w-full bg-black" />;
                  }

                  if (previewKind === "audio") {
                    return (
                      <div className="p-4">
                        <audio src={fileHref} controls className="w-full" />
                      </div>
                    );
                  }

                  if (previewKind === "pdf") {
                    return <iframe src={fileHref} title={previewItem.name} className="h-96 w-full bg-white" />;
                  }

                  if (previewKind === "text") {
                    return <iframe src={fileHref} title={previewItem.name} className="h-96 w-full bg-white" />;
                  }

                  return (
                    <div className="p-4 text-sm text-slate-600">
                      Preview is not embedded for this file type.
                      <div className="mt-3">
                        <Link href={fileHref} target="_blank" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
                          Open file
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Select a file or folder to preview it here.</p>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500">
          Drag a row onto a folder row to move it. If multiple items are selected, dragging any one
          of them moves the whole selection.
        </div>
      </div>
    </div>
  );
}
