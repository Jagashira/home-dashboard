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
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M10.5 3a7.5 7.5 0 1 1-5.3 12.8l-2.5 2.5-1.4-1.4 2.5-2.5A7.5 7.5 0 0 1 10.5 3m0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
      <path d="M12 5c5.5 0 9.7 4.6 11 7-1.3 2.4-5.5 7-11 7S2.3 14.4 1 12c1.3-2.4 5.5-7 11-7m0 2c-3.8 0-7 3-8.7 5 1.7 2 4.9 5 8.7 5s7-3 8.7-5c-1.7-2-4.9-5-8.7-5m0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
      <path d="M11 4h2v8.2l2.6-2.6 1.4 1.4-5 5-5-5 1.4-1.4 2.6 2.6zm-6 12h14v4H5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
      <path d="M6 10.5A1.5 1.5 0 1 1 6 13.5 1.5 1.5 0 0 1 6 10.5m6 0A1.5 1.5 0 1 1 12 13.5 1.5 1.5 0 0 1 12 10.5m6 0A1.5 1.5 0 1 1 18 13.5 1.5 1.5 0 0 1 18 10.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    </svg>
  );
}

function FileBadge({ entry }: { entry: StorageItem }) {
  const previewKind = getPreviewKind(entry.name);

  const tone =
    entry.kind === "directory"
      ? "bg-amber-100 text-amber-700"
      : previewKind === "image"
        ? "bg-emerald-100 text-emerald-700"
        : previewKind === "video"
          ? "bg-violet-100 text-violet-700"
          : previewKind === "audio"
            ? "bg-sky-100 text-sky-700"
            : previewKind === "pdf"
              ? "bg-rose-100 text-rose-700"
              : "bg-slate-100 text-slate-700";

  const label =
    entry.kind === "directory"
      ? "DIR"
      : previewKind === "image"
        ? "IMG"
        : previewKind === "video"
          ? "VID"
          : previewKind === "audio"
            ? "AUD"
            : previewKind === "pdf"
              ? "PDF"
              : previewKind === "text"
                ? "TXT"
                : "FILE";

  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.12em] ${tone}`}
    >
      {entry.kind === "directory" ? <FolderIcon /> : label}
    </span>
  );
}

export function StorageDrivePanel({ currentPath, entries, directories }: StorageDrivePanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [moveTarget, setMoveTarget] = useState(currentPath);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) => entry.name.toLowerCase().includes(normalizedQuery));
  }, [entries, query]);

  const selectedItems = useMemo(
    () => entries.filter((entry) => selectedPaths.includes(entry.relativePath)),
    [entries, selectedPaths]
  );
  const previewItem =
    entries.find((entry) => entry.relativePath === previewPath) ?? selectedItems[0] ?? null;
  const allSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selectedPaths.includes(entry.relativePath));

  function toggleSelection(relativePath: string) {
    setSelectedPaths((current) =>
      current.includes(relativePath)
        ? current.filter((item) => item !== relativePath)
        : [...current, relativePath]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedPaths((current) =>
        current.filter((item) => !filteredEntries.some((entry) => entry.relativePath === item))
      );
      return;
    }

    setSelectedPaths((current) => {
      const next = new Set(current);
      filteredEntries.forEach((entry) => next.add(entry.relativePath));
      return Array.from(next);
    });
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

  async function handleDelete(paths: string[]) {
    if (!paths.length || isWorking) {
      return;
    }

    const confirmed = window.confirm(`Delete ${paths.length} item(s)?`);
    if (!confirmed) {
      return;
    }

    setIsWorking(true);

    try {
      for (const relativePath of paths) {
        const formData = new FormData();
        formData.append("path", relativePath);
        await postForm("/storage/delete", formData);
      }

      setSelectedPaths([]);
      setPreviewPath(null);
      setMenuPath(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRename(relativePath: string, currentName?: string) {
    if (isWorking) {
      return;
    }

    const nextName = window.prompt("Rename item", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("path", relativePath);
      formData.append("name", nextName);
      await postForm("/storage/rename", formData);

      setSelectedPaths([]);
      setPreviewPath(null);
      setMenuPath(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename the selected item.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMove(paths: string[]) {
    if (!paths.length || isWorking) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("targetPath", moveTarget);
      paths.forEach((item) => formData.append("paths", item));
      await postForm("/storage/move", formData);

      setSelectedPaths([]);
      setPreviewPath(null);
      setMenuPath(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to move the selected items.";
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
      setMenuPath(null);
      setDropTargetPath(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to move the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-white/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Files</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search, preview, rename, move, and drag items between folders.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
          <div className="relative w-full lg:max-w-md">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files..."
              className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">
              {selectedItems.length} selected
            </span>
            <select
              value={moveTarget}
              onChange={(event) => setMoveTarget(event.target.value)}
              disabled={!selectedItems.length || isWorking}
              className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {directories.map((directory) => (
                <option key={directory.path || "root"} value={directory.path}>
                  {directory.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleMove(selectedPaths)}
              disabled={!selectedItems.length || isWorking}
              className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Move
            </button>
            <button
              type="button"
              onClick={() =>
                selectedItems.length === 1
                  ? void handleRename(selectedItems[0].relativePath, selectedItems[0].name)
                  : undefined
              }
              disabled={selectedItems.length !== 1 || isWorking}
              className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(selectedPaths)}
              disabled={!selectedItems.length || isWorking}
              className="h-11 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-lg font-medium text-slate-800">
            {query ? "No results in this folder." : "This folder is empty."}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {query
              ? "Try another search term or open a different folder."
              : "Upload files or create a folder to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500">
              <tr>
                <th className="w-14 px-5 py-4">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Size</th>
                <th className="px-5 py-4 font-medium">Modified</th>
                <th className="w-48 px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => {
                const fileHref = buildFileHref(entry.relativePath);
                const isSelected = selectedPaths.includes(entry.relativePath);
                const isMenuOpen = menuPath === entry.relativePath;

                return (
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
                      "transition hover:bg-slate-50/80",
                      isSelected ? "bg-blue-50/60" : "",
                      dropTargetPath === entry.relativePath ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(entry.relativePath)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <FileBadge entry={entry} />
                        <div className="min-w-0">
                          {entry.kind === "directory" ? (
                            <Link
                              href={buildStorageHref(entry.relativePath)}
                              className="block truncate text-base font-medium text-slate-900 hover:no-underline"
                            >
                              {entry.name}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewPath(entry.relativePath)}
                              className="block truncate text-left text-base font-medium text-slate-900"
                            >
                              {entry.name}
                            </button>
                          )}
                          <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-slate-400">
                            {entry.kind}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-base text-slate-600">
                      {formatSize(entry.size, entry.kind)}
                    </td>
                    <td className="px-5 py-3 text-base text-slate-600">
                      {formatTimestamp(entry.updatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="relative flex items-center justify-end gap-2">
                        {entry.kind === "directory" ? (
                          <Link
                            href={buildStorageHref(entry.relativePath)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 hover:no-underline"
                            aria-label={`Open ${entry.name}`}
                          >
                            <EyeIcon />
                          </Link>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewPath(entry.relativePath)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Preview ${entry.name}`}
                            >
                              <EyeIcon />
                            </button>
                            <Link
                              href={fileHref}
                              download={entry.name}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 hover:no-underline"
                              aria-label={`Download ${entry.name}`}
                            >
                              <DownloadIcon />
                            </Link>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setMenuPath((currentMenuPath) =>
                              currentMenuPath === entry.relativePath ? null : entry.relativePath
                            )
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`More actions for ${entry.name}`}
                        >
                          <MoreIcon />
                        </button>

                        {isMenuOpen ? (
                          <div className="absolute right-0 top-12 z-20 min-w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuPath(null);
                                setSelectedPaths([entry.relativePath]);
                                if (entry.kind === "directory") {
                                  router.push(buildStorageHref(entry.relativePath));
                                } else {
                                  setPreviewPath(entry.relativePath);
                                }
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {entry.kind === "directory" ? "Open" : "Preview"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRename(entry.relativePath, entry.name)}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPaths([entry.relativePath]);
                                void handleDelete([entry.relativePath]);
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/80 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-700">{filteredEntries.length} visible</span>
          <span className="text-slate-300">•</span>
          <span>{entries.length} total in this folder</span>
        </div>
        <div>Drag rows onto a folder row to move them.</div>
      </div>

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{previewItem.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {previewItem.kind} • {formatTimestamp(previewItem.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPath(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-auto bg-slate-50 p-6">
              {previewItem.kind === "directory" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-600">
                  Open this folder to browse its contents.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  {(() => {
                    const previewKind = getPreviewKind(previewItem.name);
                    const fileHref = buildFileHref(previewItem.relativePath);

                    if (previewKind === "image") {
                      return (
                        <img
                          src={fileHref}
                          alt={previewItem.name}
                          className="max-h-[72vh] w-full object-contain bg-slate-100"
                        />
                      );
                    }

                    if (previewKind === "video") {
                      return <video src={fileHref} controls className="max-h-[72vh] w-full bg-black" />;
                    }

                    if (previewKind === "audio") {
                      return (
                        <div className="p-8">
                          <audio src={fileHref} controls className="w-full" />
                        </div>
                      );
                    }

                    if (previewKind === "pdf" || previewKind === "text") {
                      return <iframe src={fileHref} title={previewItem.name} className="h-[72vh] w-full bg-white" />;
                    }

                    return (
                      <div className="p-8 text-sm text-slate-600">
                        Preview is not embedded for this file type.
                        <div className="mt-4">
                          <Link
                            href={fileHref}
                            target="_blank"
                            className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:no-underline"
                          >
                            Open file
                          </Link>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
