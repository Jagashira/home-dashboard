import { APP_CONFIG } from "@/lib/config";

type ImmichAboutInfo = {
  version?: string;
};

type ImmichStorageInfo = {
  diskSizeRaw?: number | string | null;
  diskUseRaw?: number | string | null;
  diskAvailableRaw?: number | string | null;
  diskUsagePercentage?: number | string | null;
};

type ImmichUserUsage = {
  userName?: string | null;
  userId?: string | null;
  photos?: number | string | null;
  videos?: number | string | null;
  usage?: number | string | null;
};

type ImmichServerStatistics = {
  photos?: number | string | null;
  videos?: number | string | null;
  usage?: number | string | null;
  usageByUser?: ImmichUserUsage[] | null;
};

export type ImmichSummary = {
  available: boolean;
  href: string;
  version: string | null;
  storage: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercentage: number;
    totalLabel: string;
    usedLabel: string;
    availableLabel: string;
    usageLabel: string;
  };
  stats: {
    photos: number;
    videos: number;
    assets: number;
    usageBytes: number;
    usageLabel: string;
  };
  topUsers: Array<{
    name: string;
    photos: number;
    videos: number;
    usageBytes: number;
    usageLabel: string;
  }>;
};

function getImmichHref() {
  return APP_CONFIG.immichBaseUrl || "/immich";
}

function normalizeBaseUrl() {
  const value = APP_CONFIG.immichBaseUrl.trim();
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

async function fetchImmich<T>(path: string): Promise<T> {
  const baseUrl = normalizeBaseUrl();
  if (!baseUrl || !APP_CONFIG.immichApiKey) {
    throw new Error("Immich is not configured");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      "x-api-key": APP_CONFIG.immichApiKey
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Immich request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getImmichSummary(): Promise<ImmichSummary> {
  const href = getImmichHref();
  if (!normalizeBaseUrl() || !APP_CONFIG.immichApiKey) {
    return {
      available: false,
      href,
      version: null,
      storage: {
        totalBytes: 0,
        usedBytes: 0,
        availableBytes: 0,
        usagePercentage: 0,
        totalLabel: "—",
        usedLabel: "—",
        availableLabel: "—",
        usageLabel: "未設定"
      },
      stats: {
        photos: 0,
        videos: 0,
        assets: 0,
        usageBytes: 0,
        usageLabel: "—"
      },
      topUsers: []
    };
  }

  const [about, storage, statistics] = await Promise.all([
    fetchImmich<ImmichAboutInfo>("/api/server/about"),
    fetchImmich<ImmichStorageInfo>("/api/server/storage"),
    fetchImmich<ImmichServerStatistics>("/api/server/statistics")
  ]);

  const totalBytes = toNumber(storage.diskSizeRaw);
  const usedBytes = toNumber(storage.diskUseRaw);
  const availableBytes = toNumber(storage.diskAvailableRaw);
  const usagePercentage =
    toNumber(storage.diskUsagePercentage) || (totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0);
  const photos = toNumber(statistics.photos);
  const videos = toNumber(statistics.videos);
  const usageBytes = toNumber(statistics.usage);
  const topUsers = (statistics.usageByUser ?? [])
    .map((user) => ({
      name: user.userName?.trim() || user.userId || "unknown",
      photos: toNumber(user.photos),
      videos: toNumber(user.videos),
      usageBytes: toNumber(user.usage),
      usageLabel: formatBytes(toNumber(user.usage))
    }))
    .sort((a, b) => b.usageBytes - a.usageBytes)
    .slice(0, 3);

  return {
    available: true,
    href,
    version: about.version ?? null,
    storage: {
      totalBytes,
      usedBytes,
      availableBytes,
      usagePercentage,
      totalLabel: formatBytes(totalBytes),
      usedLabel: formatBytes(usedBytes),
      availableLabel: formatBytes(availableBytes),
      usageLabel: `${usagePercentage.toFixed(usagePercentage >= 10 ? 0 : 1)}% used`
    },
    stats: {
      photos,
      videos,
      assets: photos + videos,
      usageBytes,
      usageLabel: formatBytes(usageBytes)
    },
    topUsers
  };
}
