"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  StorageBreadcrumb,
  StorageDirectoryOption,
  StorageItem,
  StorageLibraryKey
} from "@/lib/storage";

type StorageDrivePanelProps = {
  libraryKey: StorageLibraryKey;
  libraryLabel: string;
  readOnly: boolean;
  currentPath: string;
  breadcrumbs: StorageBreadcrumb[];
  entries: StorageItem[];
  directories: StorageDirectoryOption[];
};

type SortKey = "name" | "size" | "kind" | "updatedAt";
type SortDirection = "asc" | "desc";
type FilterKind = "all" | "files" | "folders";
type MenuState = {
  path: string;
  x?: number;
  y?: number;
} | null;

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
    return "—";
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

function buildStorageHref(currentPath: string, libraryKey: StorageLibraryKey) {
  const params = new URLSearchParams({ library: libraryKey });
  if (currentPath) {
    params.set("path", currentPath);
  }

  return `/storage?${params.toString()}`;
}

function buildFileHref(relativePath: string, libraryKey: StorageLibraryKey) {
  return `/storage/files/${relativePath.split("/").map(encodeURIComponent).join("/")}?library=${libraryKey}`;
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
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
      <path d="M10.5 3a7.5 7.5 0 1 1-5.3 12.8l-2.5 2.5-1.4-1.4 2.5-2.5A7.5 7.5 0 0 1 10.5 3m0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M11 4h2v8.2l2.6-2.6 1.4 1.4-5 5-5-5 1.4-1.4 2.6 2.6zm-6 12h14v4H5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M6 10.5A1.5 1.5 0 1 1 6 13.5 1.5 1.5 0 0 1 6 10.5m6 0A1.5 1.5 0 1 1 12 13.5 1.5 1.5 0 0 1 12 10.5m6 0A1.5 1.5 0 1 1 18 13.5 1.5 1.5 0 0 1 18 10.5" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M4 7h16v2H4zm0 6h16v2H4zm0 6h16v2H4z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-11 w-11 fill-current text-amber-400" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    </svg>
  );
}

function FileBadge({ entry }: { entry: StorageItem }) {
  const previewKind = getPreviewKind(entry.name);

  if (entry.kind === "directory") {
    return <FolderIcon />;
  }

  const tone =
    previewKind === "image"
      ? "bg-emerald-100 text-emerald-700"
      : previewKind === "video"
        ? "bg-slate-700 text-white"
        : previewKind === "audio"
          ? "bg-slate-600 text-white"
          : previewKind === "pdf"
            ? "bg-rose-500 text-white"
            : "bg-slate-100 text-slate-700";

  const label =
    previewKind === "image"
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
    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("a,button,input,select,textarea,summary,[role='button']"));
}

function getSortIndicator(activeKey: SortKey, currentKey: SortKey, direction: SortDirection) {
  if (activeKey !== currentKey) {
    return "";
  }

  return direction === "asc" ? " ↑" : " ↓";
}

export function StorageDrivePanel({
  libraryKey,
  libraryLabel,
  readOnly,
  currentPath,
  breadcrumbs,
  entries,
  directories
}: StorageDrivePanelProps) {
  const router = useRouter();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const mobileOptionsRef = useRef<HTMLDivElement>(null);
  const tableDropRef = useRef<HTMLDivElement>(null);
  const shiftPressedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [moveTarget, setMoveTarget] = useState(currentPath);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>(null);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextEntries = entries.filter((entry) => {
      if (filterKind === "files" && entry.kind !== "file") {
        return false;
      }

      if (filterKind === "folders" && entry.kind !== "directory") {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return entry.name.toLowerCase().includes(normalizedQuery);
    });

    nextEntries.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }

      if (sortKey === "size") {
        return (left.size - right.size) * direction;
      }

      if (sortKey === "updatedAt") {
        return (
          (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction
        );
      }

      if (sortKey === "kind") {
        return left.kind.localeCompare(right.kind) * direction;
      }

      return left.name.localeCompare(right.name, "ja") * direction;
    });

    return nextEntries;
  }, [entries, filterKind, query, sortDirection, sortKey]);

  const selectedItems = useMemo(
    () => entries.filter((entry) => selectedPaths.includes(entry.relativePath)),
    [entries, selectedPaths]
  );
  const previewItem = previewPath
    ? filteredEntries.find((entry) => entry.relativePath === previewPath) ??
      entries.find((entry) => entry.relativePath === previewPath) ??
      null
    : null;
  const previewFiles = filteredEntries.filter((entry) => entry.kind === "file");
  const previewIndex = previewItem
    ? previewFiles.findIndex((entry) => entry.relativePath === previewItem.relativePath)
    : -1;
  const previousPreviewItem = previewIndex > 0 ? previewFiles[previewIndex - 1] : null;
  const nextPreviewItem =
    previewIndex !== -1 && previewIndex < previewFiles.length - 1 ? previewFiles[previewIndex + 1] : null;
  const allSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selectedPaths.includes(entry.relativePath));

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current && !menuRootRef.current.contains(target)) {
        setMenuState(null);
      }

      if (mobileOptionsRef.current && !mobileOptionsRef.current.contains(target)) {
        setMobileOptionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      shiftPressedRef.current = event.shiftKey;
    }

    function handleKeyUp(event: KeyboardEvent) {
      shiftPressedRef.current = event.shiftKey;
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const desktopActionsVisible = selectedItems.length > 0;

  function toggleSelection(relativePath: string, useRangeSelection = false) {
    if (useRangeSelection && lastSelectedPath) {
      const startIndex = filteredEntries.findIndex((entry) => entry.relativePath === lastSelectedPath);
      const endIndex = filteredEntries.findIndex((entry) => entry.relativePath === relativePath);

      if (startIndex !== -1 && endIndex !== -1) {
        const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const nextPaths = filteredEntries.slice(from, to + 1).map((entry) => entry.relativePath);
        setSelectedPaths((current) => Array.from(new Set([...current, ...nextPaths])));
        setLastSelectedPath(relativePath);
        return;
      }
    }

    setSelectedPaths((current) =>
      current.includes(relativePath)
        ? current.filter((item) => item !== relativePath)
        : [...current, relativePath]
    );
    setLastSelectedPath(relativePath);
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

  function updateSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "updatedAt" ? "desc" : "asc");
  }

  function openRename(relativePath: string, name: string) {
    setRenamingPath(relativePath);
    setRenameValue(name);
    setMenuState(null);
  }

  async function postForm(url: string, formData: FormData) {
    formData.set("library", libraryKey);

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
      setLastSelectedPath(null);
      setPreviewPath(null);
      setMenuState(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete the selected items.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function submitRename(relativePath: string) {
    const nextName = renameValue.trim();
    const currentName = entries.find((entry) => entry.relativePath === relativePath)?.name;

    if (isWorking || !nextName || nextName === currentName) {
      setRenamingPath(null);
      setRenameValue("");
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("path", relativePath);
      formData.append("name", nextName);
      await postForm("/storage/rename", formData);

      setSelectedPaths([]);
      setLastSelectedPath(null);
      setPreviewPath(null);
      setMenuState(null);
      setRenamingPath(null);
      setRenameValue("");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename the selected item.";
      window.alert(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMove(paths: string[]) {
    if (!paths.length || isWorking || readOnly) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("targetPath", moveTarget);
      paths.forEach((item) => formData.append("paths", item));
      await postForm("/storage/move", formData);

      setSelectedPaths([]);
      setLastSelectedPath(null);
      setPreviewPath(null);
      setMenuState(null);
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
    if (!draggedPaths.length || isWorking || readOnly) {
      return;
    }

    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("targetPath", targetRelativePath);
      draggedPaths.forEach((item) => formData.append("paths", item));
      await postForm("/storage/move", formData);

      setSelectedPaths([]);
      setLastSelectedPath(null);
      setPreviewPath(null);
      setMenuState(null);
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
    <div ref={menuRootRef} className="flex min-w-0 flex-col">
      <div className="border-b border-slate-200 bg-white px-5 py-4 lg:px-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0 whitespace-nowrap text-sm font-medium text-slate-500">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              {breadcrumbs.map((breadcrumb, index) => (
                <div key={`${breadcrumb.path || "root"}-${index}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 ? <span className="text-slate-300">/</span> : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="truncate text-slate-500">{breadcrumb.label}</span>
                  ) : (
                    <Link
                      href={buildStorageHref(breadcrumb.path, libraryKey)}
                      className="truncate text-blue-600 hover:no-underline"
                    >
                      {breadcrumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="relative w-full">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files..."
                className="h-12 w-full rounded-[16px] border border-slate-200 bg-white pl-4 pr-12 text-base text-slate-700 outline-none transition focus:border-blue-300"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
            </div>
          </div>

          <div ref={mobileOptionsRef} className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOptionsOpen((current) => !current)}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-500"
            >
              <OptionsIcon />
            </button>
            {mobileOptionsOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-72 rounded-[22px] border border-slate-200 bg-white p-4 shadow-xl">
                <div className="space-y-3">
                  <div className="rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    {selectedItems.length} selected
                  </div>
                  <div className="flex gap-2">
                    {(["all", "folders", "files"] as FilterKind[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setFilterKind(item)}
                        className={[
                          "rounded-full px-3 py-2 text-xs font-medium",
                          filterKind === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                        ].join(" ")}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <select
                    value={`${sortKey}:${sortDirection}`}
                    onChange={(event) => {
                      const [nextKey, nextDirection] = event.target.value.split(":") as [
                        SortKey,
                        SortDirection
                      ];
                      setSortKey(nextKey);
                      setSortDirection(nextDirection);
                    }}
                    className="h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700"
                  >
                    <option value="name:asc">Name ↑</option>
                    <option value="name:desc">Name ↓</option>
                    <option value="updatedAt:desc">Date ↓</option>
                    <option value="updatedAt:asc">Date ↑</option>
                    <option value="size:desc">Size ↓</option>
                    <option value="size:asc">Size ↑</option>
                  </select>
                  <select
                    value={moveTarget}
                    onChange={(event) => setMoveTarget(event.target.value)}
                    disabled={!selectedItems.length || isWorking || readOnly}
                    className="h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                    disabled={!selectedItems.length || isWorking || readOnly}
                    className="h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      selectedItems.length === 1
                        ? openRename(selectedItems[0].relativePath, selectedItems[0].name)
                        : undefined
                    }
                    disabled={selectedItems.length !== 1 || isWorking || readOnly}
                    className="h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selectedPaths)}
                    disabled={!selectedItems.length || isWorking || readOnly}
                    className="h-12 w-full rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-span-3 hidden items-center justify-between gap-3 lg:flex">
            <div className="flex items-center gap-2">
              {(["all", "folders", "files"] as FilterKind[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilterKind(item)}
                  className={[
                    "rounded-full px-3 py-2 text-xs font-medium",
                    filterKind === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>

            {desktopActionsVisible ? (
              <div className="flex items-center justify-end gap-2">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  {selectedItems.length} selected
                </span>
                <select
                  value={moveTarget}
                  onChange={(event) => setMoveTarget(event.target.value)}
                  disabled={!selectedItems.length || isWorking || readOnly}
                  className="h-11 min-w-[200px] rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  disabled={!selectedItems.length || isWorking || readOnly}
                  className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Move
                </button>
                <button
                  type="button"
                  onClick={() =>
                    selectedItems.length === 1
                      ? openRename(selectedItems[0].relativePath, selectedItems[0].name)
                      : undefined
                  }
                  disabled={selectedItems.length !== 1 || isWorking || readOnly}
                  className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedPaths)}
                  disabled={!selectedItems.length || isWorking || readOnly}
                  className="h-11 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {readOnly ? <span>Read only</span> : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="border-t border-slate-100 px-5 py-20 text-center">
          <p className="text-xl font-medium text-slate-900">
            {query ? "No results in this folder." : "This folder is empty."}
          </p>
        </div>
      ) : (
        <div
          ref={tableDropRef}
          className="overflow-x-auto"
          onDragOver={(event) => {
            if (readOnly) {
              return;
            }

            event.preventDefault();
            setDropTargetPath("");
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }

            if (dropTargetPath === "") {
              setDropTargetPath(null);
            }
          }}
          onDrop={(event) => {
            if (readOnly) {
              return;
            }

            event.preventDefault();
            const raw = event.dataTransfer.getData("application/json");
            const draggedPaths = raw ? (JSON.parse(raw) as string[]) : [];
            void handleDropOnFolder(currentPath, draggedPaths);
          }}
        >
          <table className="min-w-[980px] w-full text-left">
            <thead className="border-b border-slate-200 text-sm text-slate-600">
              <tr>
                <th className="w-16 px-6 py-5">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="w-[44%] px-6 py-4 font-medium">
                  <button type="button" onClick={() => updateSort("name")} className="hover:text-slate-900">
                    Name{getSortIndicator(sortKey, "name", sortDirection)}
                  </button>
                </th>
                <th className="w-[12%] px-6 py-4 font-medium">
                  <button type="button" onClick={() => updateSort("size")} className="hover:text-slate-900">
                    Size{getSortIndicator(sortKey, "size", sortDirection)}
                  </button>
                </th>
                <th className="w-[14%] px-6 py-4 font-medium">
                  <button type="button" onClick={() => updateSort("kind")} className="hover:text-slate-900">
                    Type{getSortIndicator(sortKey, "kind", sortDirection)}
                  </button>
                </th>
                <th className="w-[24%] px-6 py-4 font-medium">
                  <button type="button" onClick={() => updateSort("updatedAt")} className="hover:text-slate-900">
                    Date{getSortIndicator(sortKey, "updatedAt", sortDirection)}
                  </button>
                </th>
                <th className="w-[110px] px-6 py-5 font-medium text-center">Download</th>
                <th className="w-[90px] px-6 py-5 font-medium text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => {
                const fileHref = buildFileHref(entry.relativePath, libraryKey);
                const isSelected = selectedPaths.includes(entry.relativePath);
                const isMenuOpen = menuState?.path === entry.relativePath;
                const isRenaming = renamingPath === entry.relativePath;

                return (
                  <tr
                    key={entry.relativePath}
                    draggable={!readOnly}
                    onDragStart={(event) => {
                      if (readOnly) {
                        return;
                      }

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
                      if (entry.kind !== "directory" || readOnly) {
                        return;
                      }

                      event.preventDefault();
                      const raw = event.dataTransfer.getData("application/json");
                      const draggedPaths = raw ? (JSON.parse(raw) as string[]) : [];
                      void handleDropOnFolder(entry.relativePath, draggedPaths);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedPaths((current) =>
                        current.includes(entry.relativePath) ? current : [entry.relativePath]
                      );
                      setMenuState({
                        path: entry.relativePath,
                        x: event.clientX,
                        y: event.clientY
                      });
                    }}
                    onClick={(event) => {
                      if (isInteractiveTarget(event.target) || isRenaming) {
                        return;
                      }

                      toggleSelection(entry.relativePath, event.shiftKey);
                    }}
                    className={[
                      "transition hover:bg-slate-50/70",
                      isSelected ? "bg-blue-50/50" : "",
                      dropTargetPath === entry.relativePath ? "bg-blue-50" : "",
                      dropTargetPath === "" ? "ring-1 ring-inset ring-blue-200" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-6 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleSelection(entry.relativePath, shiftPressedRef.current);
                        }}
                      />
                    </td>
                    <td className="px-6 py-3 align-middle">
                      <div className="flex items-center gap-4">
                        <FileBadge entry={entry} />
                        <div className="min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void submitRename(entry.relativePath);
                                  }

                                  if (event.key === "Escape") {
                                    setRenamingPath(null);
                                    setRenameValue("");
                                  }
                                }}
                                className="h-10 min-w-[220px] rounded-xl border border-blue-300 bg-white px-3 text-sm text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => void submitRename(entry.relativePath)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                              >
                                Save
                              </button>
                            </div>
                          ) : entry.kind === "directory" ? (
                            <Link
                              href={buildStorageHref(entry.relativePath, libraryKey)}
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 align-middle">
                      {formatSize(entry.size, entry.kind)}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 align-middle">
                      {entry.kind}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 align-middle">
                      {formatTimestamp(entry.updatedAt)}
                    </td>
                    <td className="px-6 py-3 align-middle text-center text-slate-500">
                      {entry.kind === "directory" ? (
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-300">
                          —
                        </span>
                      ) : (
                        <Link
                          href={fileHref}
                          download={entry.name}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-900 hover:no-underline"
                        >
                          <DownloadIcon />
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-3 align-middle">
                      <div className="relative flex items-center justify-center text-slate-500">
                        <button
                          type="button"
                          onClick={(event) => {
                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuState((currentMenuState) =>
                              currentMenuState?.path === entry.relativePath
                                ? null
                                : { path: entry.relativePath, x: rect.right - 176, y: rect.bottom + 8 }
                            );
                          }}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <MoreIcon />
                        </button>

                        {isMenuOpen ? (
                          <div
                            className="fixed z-30 min-w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                            style={{
                              left: menuState?.x ?? 0,
                              top: menuState?.y ?? 0
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuState(null);
                                if (entry.kind === "directory") {
                                  router.push(buildStorageHref(entry.relativePath, libraryKey));
                                } else {
                                  setPreviewPath(entry.relativePath);
                                }
                              }}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {entry.kind === "directory" ? "Open" : "Preview"}
                            </button>
                            {entry.kind === "file" ? (
                              <Link
                                href={fileHref}
                                download={entry.name}
                                className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:no-underline"
                              >
                                Download
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openRename(entry.relativePath, entry.name)}
                              disabled={readOnly}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPaths([entry.relativePath]);
                                setLastSelectedPath(entry.relativePath);
                                void handleDelete([entry.relativePath]);
                              }}
                              disabled={readOnly}
                              className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
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

      <div className="border-t border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 lg:px-6">
        {entries.length} items
      </div>

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">{previewItem.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {previewItem.kind} • {formatTimestamp(previewItem.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {previousPreviewItem ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPath(previousPreviewItem.relativePath)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                  >
                    Previous
                  </button>
                ) : null}
                {nextPreviewItem ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPath(nextPreviewItem.relativePath)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                  >
                    Next
                  </button>
                ) : null}
                <Link
                  href={buildFileHref(previewItem.relativePath, libraryKey)}
                  target="_blank"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:no-underline"
                >
                  Open
                </Link>
                <Link
                  href={buildFileHref(previewItem.relativePath, libraryKey)}
                  download={previewItem.name}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:no-underline"
                >
                  Download
                </Link>
                <button
                  type="button"
                  onClick={() => setPreviewPath(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-auto bg-slate-50 p-4 sm:p-6">
              {previewItem.kind === "directory" ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-600">
                  Open this folder to browse its contents.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  {(() => {
                    const previewKind = getPreviewKind(previewItem.name);
                    const fileHref = buildFileHref(previewItem.relativePath, libraryKey);

                    if (previewKind === "image") {
                      return <img src={fileHref} alt={previewItem.name} className="max-h-[72vh] w-full object-contain bg-slate-100" />;
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
