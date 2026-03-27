import { promises as fs } from "node:fs";
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
