const OPENAI_API_BASE = "https://api.openai.com/v1";
const OPENAI_USAGE_URL = "https://platform.openai.com/usage";

type OpenAiCostResult = {
  amount?: {
    value?: number;
    currency?: string;
  };
  line_item?: string | null;
  project_id?: string | null;
};

type OpenAiCostBucket = {
  start_time?: number;
  end_time?: number;
  results?: OpenAiCostResult[];
};

type OpenAiCostsResponse = {
  data?: OpenAiCostBucket[];
};

type OpenAiCompletionsUsageResponse = {
  data?: Array<{
    results?: Array<{
      input_tokens?: number;
      output_tokens?: number;
      num_model_requests?: number;
    }>;
  }>;
};

export type OpenAiUsageSnapshot = {
  href: string;
  available: boolean;
  monthLabel: string;
  monthSpendUsd: number | null;
  monthSpendJpy: number | null;
  todaySpendUsd: number | null;
  todaySpendJpy: number | null;
  monthSpendLabel: string;
  todaySpendLabel: string;
  totalTokens: number | null;
  totalTokensLabel: string;
  detail: string;
};

function startOfMonthUnix(now: Date) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

function startOfDayUnix(now: Date) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function formatMonthLabel(now: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long"
  }).format(now);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatJpy(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getAdminApiKey() {
  return process.env.OPENAI_ADMIN_API_KEY?.trim() || process.env.OPENAI_ADMIN_KEY?.trim() || "";
}

function sumCosts(response: OpenAiCostsResponse) {
  return (response.data ?? []).reduce((total, bucket) => {
    const bucketTotal = (bucket.results ?? []).reduce((sum, result) => {
      const value = result.amount?.value;
      return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
    return total + bucketTotal;
  }, 0);
}

function sumBucketCosts(bucket: OpenAiCostBucket | undefined) {
  return (bucket?.results ?? []).reduce((sum, result) => {
    const value = result.amount?.value;
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

function getLatestDailyCost(response: OpenAiCostsResponse) {
  const buckets = response.data ?? [];
  const latestBucketWithValues = [...buckets].reverse().find((bucket) => (bucket.results ?? []).length > 0);
  return latestBucketWithValues ? sumBucketCosts(latestBucketWithValues) : 0;
}

async function fetchCosts(startTime: number, endTime: number, limit: number) {
  const adminApiKey = getAdminApiKey();
  const query = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(endTime),
    bucket_width: "1d",
    limit: String(limit)
  });

  const response = await fetch(`${OPENAI_API_BASE}/organization/costs?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${adminApiKey}`
    },
    cache: "no-store"
  });

  return response;
}

async function fetchCompletionsUsage(startTime: number, endTime: number, limit: number) {
  const adminApiKey = getAdminApiKey();
  const query = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(endTime),
    bucket_width: "1d",
    limit: String(limit)
  });

  const response = await fetch(`${OPENAI_API_BASE}/organization/usage/completions?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${adminApiKey}`
    },
    cache: "no-store"
  });

  return response;
}

function sumCompletionUsage(response: OpenAiCompletionsUsageResponse) {
  return (response.data ?? []).reduce(
    (totals, bucket) => {
      for (const result of bucket.results ?? []) {
        totals.tokens += result.input_tokens ?? 0;
      }
      return totals;
    },
    { tokens: 0 }
  );
}

export async function getOpenAiUsageSnapshot(now = new Date()): Promise<OpenAiUsageSnapshot> {
  const monthLabel = formatMonthLabel(now);
  const adminApiKey = getAdminApiKey();
  const usdToJpy = 150;

  if (!adminApiKey) {
    return {
      href: OPENAI_USAGE_URL,
      available: false,
      monthLabel,
      monthSpendUsd: null,
      monthSpendJpy: null,
      todaySpendUsd: null,
      todaySpendJpy: null,
      monthSpendLabel: "—",
      todaySpendLabel: "—",
      totalTokens: null,
      totalTokensLabel: "—",
      detail: "OPENAI_ADMIN_API_KEY を設定すると usage を取得できます"
    };
  }

  try {
    const [monthResponse, usageResponse] = await Promise.all([
      fetchCosts(startOfMonthUnix(now), Math.floor(now.getTime() / 1000), 31),
      fetchCompletionsUsage(startOfMonthUnix(now), Math.floor(now.getTime() / 1000), 31)
    ]);

    if (!monthResponse.ok || !usageResponse.ok) {
      const failedResponse = !monthResponse.ok ? monthResponse : usageResponse;
      const errorText = await failedResponse.text();
      return {
        href: OPENAI_USAGE_URL,
        available: false,
        monthLabel,
        monthSpendUsd: null,
        monthSpendJpy: null,
        todaySpendUsd: null,
        todaySpendJpy: null,
        monthSpendLabel: "—",
        todaySpendLabel: "—",
        totalTokens: null,
        totalTokensLabel: "—",
        detail: errorText.slice(0, 90) || "OpenAI costs endpoint の取得に失敗しました"
      };
    }

    const monthJson = (await monthResponse.json()) as OpenAiCostsResponse;
    const usageJson = (await usageResponse.json()) as OpenAiCompletionsUsageResponse;
    const monthSpendUsd = sumCosts(monthJson);
    const todaySpendUsd = getLatestDailyCost(monthJson);
    const usage = sumCompletionUsage(usageJson);
    const monthSpendJpy = monthSpendUsd * usdToJpy;
    const todaySpendJpy = todaySpendUsd * usdToJpy;

    return {
      href: OPENAI_USAGE_URL,
      available: true,
      monthLabel,
      monthSpendUsd,
      monthSpendJpy,
      todaySpendUsd,
      todaySpendJpy,
      monthSpendLabel: formatJpy(monthSpendJpy),
      todaySpendLabel: formatJpy(todaySpendJpy),
      totalTokens: usage.tokens,
      totalTokensLabel: formatInteger(usage.tokens),
      detail: `${monthLabel} ${formatUsd(monthSpendUsd)} / ${formatInteger(usage.tokens)} tok`
    };
  } catch (error) {
    return {
      href: OPENAI_USAGE_URL,
      available: false,
      monthLabel,
      monthSpendUsd: null,
      monthSpendJpy: null,
      todaySpendUsd: null,
      todaySpendJpy: null,
      monthSpendLabel: "—",
      todaySpendLabel: "—",
      totalTokens: null,
      totalTokensLabel: "—",
      detail: error instanceof Error ? error.message : "OpenAI usage の取得中にエラーが発生しました"
    };
  }
}
