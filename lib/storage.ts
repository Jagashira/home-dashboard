import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

export type StorageItem = {
  name: string;
  kind: "file" | "directory";
  size: number;
  updatedAt: string;
};

export type StorageDirectoryState =
  | {
      status: "ready";
      configuredBasePath: string;
      resolvedBasePath: string;
      entries: StorageItem[];
      message: string;
    }
  | {
      status: "missing-env" | "missing-directory" | "read-error";
      configuredBasePath: string | null;
      resolvedBasePath: string | null;
      entries: [];
      message: string;
    };

function resolveBasePath(basePath: string) {
  return path.isAbsolute(basePath) ? basePath : path.resolve(process.cwd(), basePath);
}

function isSafeEntryName(name: string) {
  return Boolean(name) && path.basename(name) === name && !name.includes("/") && !name.includes("\\");
}

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

export function guessMimeType(name: string) {
  return MIME_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

export async function getResolvedStorageBasePath() {
  const configuredBasePath = process.env.STORAGE_BASE_PATH?.trim();

  if (!configuredBasePath) {
    throw new Error("STORAGE_BASE_PATH is not configured.");
  }

  const resolvedBasePath = resolveBasePath(configuredBasePath);
  await fs.access(resolvedBasePath);
  return resolvedBasePath;
}

export async function resolveStorageEntryPath(name: string) {
  if (!isSafeEntryName(name)) {
    throw new Error("Invalid storage entry name.");
  }

  const basePath = await getResolvedStorageBasePath();
  return path.join(basePath, name);
}

export async function getStorageDirectoryState(): Promise<StorageDirectoryState> {
  const configuredBasePath = process.env.STORAGE_BASE_PATH?.trim();

  if (!configuredBasePath) {
    return {
      status: "missing-env",
      configuredBasePath: null,
      resolvedBasePath: null,
      entries: [],
      message:
        "STORAGE_BASE_PATH is not set. Configure it to point to the directory you want to browse."
    };
  }

  const resolvedBasePath = resolveBasePath(configuredBasePath);

  try {
    const directoryEntries = await fs.readdir(resolvedBasePath, { withFileTypes: true });
    const entries = await Promise.all(
      directoryEntries.map(async (entry) => {
        const fullPath = path.join(resolvedBasePath, entry.name);
        const stats = await fs.stat(fullPath);

        return {
          name: entry.name,
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
      configuredBasePath,
      resolvedBasePath,
      entries,
      message:
        entries.length === 0
          ? "The directory is empty."
          : `Showing ${entries.length} item${entries.length === 1 ? "" : "s"} from the base directory.`
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;

    if (code === "ENOENT") {
      return {
        status: "missing-directory",
        configuredBasePath,
        resolvedBasePath,
        entries: [],
        message: "The configured base directory does not exist."
      };
    }

    return {
      status: "read-error",
      configuredBasePath,
      resolvedBasePath,
      entries: [],
      message: "Failed to read the configured base directory."
    };
  }
}

export async function uploadStorageFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error("Choose a file to upload.");
  }

  const fileName = path.basename(file.name).trim();

  if (!isSafeEntryName(fileName)) {
    throw new Error("The selected file name is not allowed.");
  }

  const targetPath = await resolveStorageEntryPath(fileName);

  try {
    await fs.access(targetPath);
    throw new Error("A file with the same name already exists.");
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code && code !== "ENOENT") {
      throw error;
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(targetPath, bytes);

  return {
    fileName,
    message: `Uploaded ${fileName}.`
  };
}

export async function deleteStorageEntry(name: string) {
  const targetPath = await resolveStorageEntryPath(name);
  const stats = await fs.stat(targetPath);

  if (stats.isDirectory()) {
    await fs.rm(targetPath, { recursive: false, force: false });
    return { message: `Deleted directory ${name}.` };
  }

  await fs.unlink(targetPath);
  return { message: `Deleted file ${name}.` };
}

export async function getStorageFileStream(name: string) {
  const filePath = await resolveStorageEntryPath(name);
  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    throw new Error("Only files can be viewed.");
  }

  return {
    filePath,
    mimeType: guessMimeType(name),
    size: stats.size,
    stream: createReadStream(filePath)
  };
}
