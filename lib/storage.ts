import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

export type StorageLibraryKey = "storage" | "backup";

export type StorageLibraryNavItem = {
  key: StorageLibraryKey | "photos";
  label: string;
  href: string;
  readOnly: boolean;
  external?: boolean;
};

type StorageLibraryConfig = {
  key: StorageLibraryKey;
  label: string;
  readOnly: boolean;
  configuredBasePath: string | null;
  resolvedBasePath: string | null;
};

export type StorageItem = {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  size: number;
  updatedAt: string;
};

export type StorageBreadcrumb = {
  label: string;
  path: string;
};

export type StorageDirectoryOption = {
  path: string;
  label: string;
};

export type StorageDirectoryState =
  | {
      status: "ready";
      libraryKey: StorageLibraryKey;
      libraryLabel: string;
      readOnly: boolean;
      configuredBasePath: string;
      resolvedBasePath: string;
      currentPath: string;
      currentRelativeLabel: string;
      breadcrumbs: StorageBreadcrumb[];
      entries: StorageItem[];
      message: string;
    }
  | {
      status: "missing-env" | "missing-directory" | "read-error";
      libraryKey: StorageLibraryKey;
      libraryLabel: string;
      readOnly: boolean;
      configuredBasePath: string | null;
      resolvedBasePath: string | null;
      currentPath: string;
      currentRelativeLabel: string;
      breadcrumbs: StorageBreadcrumb[];
      entries: [];
      message: string;
    };

const MIME_TYPES: Record<string, string> = {
  ".aac": "audio/aac",
  ".avi": "video/x-msvideo",
  ".csv": "text/csv; charset=utf-8",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".md": "text/markdown; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

function resolveBasePath(basePath: string) {
  return path.isAbsolute(basePath) ? basePath : path.resolve(process.cwd(), basePath);
}

function getPhotosAppUrl() {
  return (
    process.env.IMMICH_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_IMMICH_URL?.trim() ||
    "/immich"
  );
}

function isSafeName(name: string) {
  return Boolean(name) && path.basename(name) === name && !name.includes("/") && !name.includes("\\");
}

export function normalizeStoragePath(input?: string | null) {
  if (!input) {
    return "";
  }

  const normalized = path.posix
    .normalize(input.replace(/\\/g, "/"))
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!normalized || normalized === ".") {
    return "";
  }

  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Invalid storage path.");
  }

  return normalized;
}

export function normalizeStorageLibrary(input?: string | null): StorageLibraryKey {
  return input === "backup" ? "backup" : "storage";
}

function getStorageLibraryConfig(libraryKey: StorageLibraryKey): StorageLibraryConfig {
  const storageConfiguredBasePath = process.env.STORAGE_BASE_PATH?.trim() ?? null;

  if (!storageConfiguredBasePath) {
    return {
      key: libraryKey,
      label: libraryKey === "backup" ? "Backup" : "Storage",
      readOnly: libraryKey === "backup",
      configuredBasePath: null,
      resolvedBasePath: null
    };
  }

  const resolvedStorageBasePath = resolveBasePath(storageConfiguredBasePath);

  if (libraryKey === "backup") {
    const resolvedBackupBasePath = path.resolve(path.dirname(resolvedStorageBasePath), "backup");
    return {
      key: "backup",
      label: "Backup",
      readOnly: true,
      configuredBasePath: resolvedBackupBasePath,
      resolvedBasePath: resolvedBackupBasePath
    };
  }

  return {
    key: "storage",
    label: "Storage",
    readOnly: false,
    configuredBasePath: storageConfiguredBasePath,
    resolvedBasePath: resolvedStorageBasePath
  };
}

export function getStorageLibraries(currentLibrary: StorageLibraryKey): StorageLibraryNavItem[] {
  const photosHref = getPhotosAppUrl();

  const items: StorageLibraryNavItem[] = [
    {
      key: "storage",
      label: "Storage",
      href: "/storage?library=storage",
      readOnly: false
    },
    {
      key: "backup",
      label: "Backup",
      href: "/storage?library=backup",
      readOnly: true
    },
    {
      key: "photos",
      label: "Photos",
      href: photosHref,
      readOnly: true,
      external: !photosHref.startsWith("/")
    }
  ];

  return items.map((item) => ({
    ...item,
    href:
      item.key === "photos"
        ? item.href
        : item.key === currentLibrary
          ? `/storage?library=${item.key}`
          : item.href
  }));
}

function buildBreadcrumbs(currentPath: string, rootLabel: string): StorageBreadcrumb[] {
  const segments = currentPath ? currentPath.split("/") : [];
  const breadcrumbs: StorageBreadcrumb[] = [{ label: rootLabel, path: "" }];

  segments.forEach((segment, index) => {
    breadcrumbs.push({
      label: segment,
      path: segments.slice(0, index + 1).join("/")
    });
  });

  return breadcrumbs;
}

export function buildStoragePagePath(
  pathname: string,
  outcome: "success" | "error",
  notice: string,
  library: StorageLibraryKey = "storage"
) {
  const params = new URLSearchParams({ outcome, notice, library });
  const normalizedPath = normalizeStoragePath(pathname);
  if (normalizedPath) {
    params.set("path", normalizedPath);
  }

  return `/storage?${params.toString()}`;
}

export function guessMimeType(name: string) {
  return MIME_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

export async function getResolvedStorageBasePath(library: StorageLibraryKey = "storage") {
  const config = getStorageLibraryConfig(library);
  if (!config.resolvedBasePath) {
    throw new Error("STORAGE_BASE_PATH is not configured.");
  }

  const resolvedBasePath = config.resolvedBasePath;
  await fs.access(resolvedBasePath);
  return resolvedBasePath;
}

async function resolveStorageAbsolutePath(relativePath = "", library: StorageLibraryKey = "storage") {
  const basePath = await getResolvedStorageBasePath(library);
  const normalizedPath = normalizeStoragePath(relativePath);
  const absolutePath = path.resolve(basePath, normalizedPath);

  if (absolutePath !== basePath && !absolutePath.startsWith(`${basePath}${path.sep}`)) {
    throw new Error("Invalid storage path.");
  }

  return {
    basePath,
    normalizedPath,
    absolutePath
  };
}

export async function resolveStorageEntryPath(
  name: string,
  currentPath = "",
  library: StorageLibraryKey = "storage"
) {
  if (!isSafeName(name)) {
    throw new Error("Invalid storage entry name.");
  }

  const parentPath = normalizeStoragePath(currentPath);
  return resolveStorageAbsolutePath(parentPath ? `${parentPath}/${name}` : name, library);
}

export async function getStorageDirectoryState(
  relativePath = "",
  library: StorageLibraryKey = "storage"
): Promise<StorageDirectoryState> {
  const config = getStorageLibraryConfig(library);
  const configuredBasePath = config.configuredBasePath;
  const currentPath = normalizeStoragePath(relativePath);
  const breadcrumbs = buildBreadcrumbs(currentPath, config.label);

  if (!configuredBasePath) {
    return {
      status: "missing-env",
      libraryKey: library,
      libraryLabel: config.label,
      readOnly: config.readOnly,
      configuredBasePath: null,
      resolvedBasePath: null,
      currentPath,
      currentRelativeLabel: currentPath || "/",
      breadcrumbs,
      entries: [],
      message:
        "STORAGE_BASE_PATH is not set. Configure it to point to the directory you want to browse."
    };
  }

  const resolvedBasePath = config.resolvedBasePath!;

  try {
    const { absolutePath } = await resolveStorageAbsolutePath(currentPath, library);
    const directoryEntries = await fs.readdir(absolutePath, { withFileTypes: true });
    const entries = await Promise.all(
      directoryEntries.map(async (entry) => {
        const entryRelativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const fullPath = path.join(absolutePath, entry.name);
        const stats = await fs.stat(fullPath);

        return {
          name: entry.name,
          relativePath: entryRelativePath,
          kind: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        } satisfies StorageItem;
      })
    );

    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "directory" ? -1 : 1;
      }

      return a.name.localeCompare(b.name, "ja");
    });

    return {
      status: "ready",
      libraryKey: library,
      libraryLabel: config.label,
      readOnly: config.readOnly,
      configuredBasePath,
      resolvedBasePath,
      currentPath,
      currentRelativeLabel: currentPath || "/",
      breadcrumbs,
      entries,
      message:
        entries.length === 0
          ? "The directory is empty."
          : `Showing ${entries.length} item${entries.length === 1 ? "" : "s"} from the current folder.`
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;

    if (code === "ENOENT") {
      return {
        status: "missing-directory",
        libraryKey: library,
        libraryLabel: config.label,
        readOnly: config.readOnly,
        configuredBasePath,
        resolvedBasePath,
        currentPath,
        currentRelativeLabel: currentPath || "/",
        breadcrumbs,
        entries: [],
        message: "The selected directory does not exist."
      };
    }

    return {
      status: "read-error",
      libraryKey: library,
      libraryLabel: config.label,
      readOnly: config.readOnly,
      configuredBasePath,
      resolvedBasePath,
      currentPath,
      currentRelativeLabel: currentPath || "/",
      breadcrumbs,
      entries: [],
      message: "Failed to read the selected directory."
    };
  }
}

function assertStorageWritable(library: StorageLibraryKey) {
  const config = getStorageLibraryConfig(library);
  if (config.readOnly) {
    throw new Error(`${config.label} is read-only.`);
  }
}

export async function uploadStorageFile(
  file: File,
  currentPath = "",
  library: StorageLibraryKey = "storage"
) {
  assertStorageWritable(library);
  if (!file || file.size <= 0) {
    throw new Error("Choose a file to upload.");
  }

  const fileName = path.basename(file.name).trim();

  if (!isSafeName(fileName)) {
    throw new Error("The selected file name is not allowed.");
  }

  const { absolutePath: targetPath } = await resolveStorageAbsolutePath(
    currentPath ? `${normalizeStoragePath(currentPath)}/${fileName}` : fileName,
    library
  );
  let alreadyExists = false;

  try {
    await fs.access(targetPath);
    alreadyExists = true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code && code !== "ENOENT") {
      throw error;
    }
  }

  if (alreadyExists) {
    throw new Error("A file with the same name already exists.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(targetPath, bytes);

  return {
    fileName,
    message: `Uploaded ${fileName}.`
  };
}

export async function createStorageDirectory(
  name: string,
  currentPath = "",
  library: StorageLibraryKey = "storage"
) {
  assertStorageWritable(library);
  const folderName = name.trim();

  if (!isSafeName(folderName)) {
    throw new Error("The folder name is not allowed.");
  }

  const { absolutePath } = await resolveStorageEntryPath(folderName, currentPath, library);
  await fs.mkdir(absolutePath);

  return {
    message: `Created folder ${folderName}.`
  };
}

export async function listStorageDirectories(
  library: StorageLibraryKey = "storage"
): Promise<StorageDirectoryOption[]> {
  const { absolutePath: rootPath } = await resolveStorageAbsolutePath("", library);
  const result: StorageDirectoryOption[] = [{ path: "", label: "/" }];

  async function walk(currentAbsolutePath: string, currentRelativePath: string) {
    const entries = await fs.readdir(currentAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;
      result.push({
        path: relativePath,
        label: `/${relativePath}`
      });

      await walk(path.join(currentAbsolutePath, entry.name), relativePath);
    }
  }

  await walk(rootPath, "");

  result.sort((a, b) => a.label.localeCompare(b.label, "ja"));
  return result;
}

export async function renameStorageEntry(
  relativePath: string,
  nextName: string,
  library: StorageLibraryKey = "storage"
) {
  assertStorageWritable(library);
  const trimmedName = nextName.trim();
  if (!isSafeName(trimmedName)) {
    throw new Error("The new name is not allowed.");
  }

  const normalizedSourcePath = normalizeStoragePath(relativePath);
  const parentPath = normalizedSourcePath.split("/").slice(0, -1).join("/");
  const { absolutePath: sourceAbsolutePath } = await resolveStorageAbsolutePath(normalizedSourcePath, library);
  const { absolutePath: destinationAbsolutePath } = await resolveStorageEntryPath(trimmedName, parentPath, library);

  if (sourceAbsolutePath === destinationAbsolutePath) {
    throw new Error("The new name is the same as the current one.");
  }

  await fs.rename(sourceAbsolutePath, destinationAbsolutePath);

  return {
    message: `Renamed to ${trimmedName}.`,
    nextPath: parentPath ? `${parentPath}/${trimmedName}` : trimmedName
  };
}

export async function moveStorageEntries(
  relativePaths: string[],
  targetPath: string,
  library: StorageLibraryKey = "storage"
) {
  assertStorageWritable(library);
  const normalizedTargetPath = normalizeStoragePath(targetPath);
  const seen = new Set<string>();

  for (const source of relativePaths.map((item) => normalizeStoragePath(item))) {
    if (!source || seen.has(source)) {
      continue;
    }

    seen.add(source);
    const { absolutePath: sourceAbsolutePath } = await resolveStorageAbsolutePath(source, library);
    const sourceName = path.basename(sourceAbsolutePath);
    const { absolutePath: destinationAbsolutePath } = await resolveStorageEntryPath(
      sourceName,
      normalizedTargetPath,
      library
    );
    let destinationExists = false;

    if (sourceAbsolutePath === destinationAbsolutePath) {
      continue;
    }

    if (normalizedTargetPath === source || normalizedTargetPath.startsWith(`${source}/`)) {
      throw new Error("Cannot move a folder into itself.");
    }

    try {
      await fs.access(destinationAbsolutePath);
      destinationExists = true;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code && code !== "ENOENT") {
        throw error;
      }
    }

    if (destinationExists) {
      throw new Error(`An item named ${sourceName} already exists in the target folder.`);
    }

    await fs.rename(sourceAbsolutePath, destinationAbsolutePath);
  }

  return {
    message: `Moved ${seen.size} item${seen.size === 1 ? "" : "s"}.`
  };
}

export async function deleteStorageEntry(relativePath: string, library: StorageLibraryKey = "storage") {
  assertStorageWritable(library);
  const { absolutePath: targetPath } = await resolveStorageAbsolutePath(relativePath, library);
  const stats = await fs.stat(targetPath);

  if (stats.isDirectory()) {
    await fs.rm(targetPath, { recursive: false, force: false });
    return { message: `Deleted directory ${path.basename(targetPath)}.` };
  }

  await fs.unlink(targetPath);
  return { message: `Deleted file ${path.basename(targetPath)}.` };
}

export async function getStorageFileStream(relativePath: string, library: StorageLibraryKey = "storage") {
  const { absolutePath: filePath } = await resolveStorageAbsolutePath(relativePath, library);
  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    throw new Error("Only files can be viewed.");
  }

  return {
    filePath,
    mimeType: guessMimeType(path.basename(filePath)),
    size: stats.size,
    stream: createReadStream(filePath)
  };
}
