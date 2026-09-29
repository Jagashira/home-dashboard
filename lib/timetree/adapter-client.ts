export type TimeTreeAdapterStatus = {
  authenticated: boolean;
  storage_state_exists: boolean;
  calendar_configured: boolean;
  calendar_found: boolean;
  calendar_name: string | null;
  calendar_url: string | null;
  ready: boolean;
  adapter_write_count: number;
};

export async function fetchTimeTreeAdapterStatus(options: {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<TimeTreeAdapterStatus> {
  const baseUrl = (options.baseUrl ?? process.env.TIMETREE_ADAPTER_BASE_URL ?? "http://api:8000").replace(/\/$/, "");
  const token = (options.token ?? process.env.TIMETREE_INTERNAL_API_TOKEN ?? "").trim();
  if (!token) throw new Error("TIMETREE_INTERNAL_API_TOKEN is required.");
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("TIMETREE_ADAPTER_BASE_URL must use HTTP or HTTPS.");
  const response = await (options.fetchImpl ?? fetch)(`${baseUrl}/internal/timetree/v1/status`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`TimeTree adapter status failed with HTTP ${response.status}.`);
  return response.json() as Promise<TimeTreeAdapterStatus>;
}
