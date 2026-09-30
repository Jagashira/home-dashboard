export type TimeTreeAdapterStatus = {
  authenticated: boolean;
  storage_state_exists: boolean;
  calendar_configured: boolean;
  calendar_found: boolean;
  calendar_name: string | null;
  calendar_id: string | null;
  calendar_url: string | null;
  ready: boolean;
  adapter_write_count: number;
};

export type TimeTreeAdapterOutcome =
  | "verified" | "reconcile_required" | "retryable_error" | "auth_required"
  | "selector_error" | "conflict" | "not_found" | "rejected";

export type TimeTreeAdapterPhase =
  | "before_browser" | "before_form" | "before_save" | "save_attempted" | "remote_verified";

export type TimeTreeAdapterResponse = {
  outcome: TimeTreeAdapterOutcome;
  phase: TimeTreeAdapterPhase;
  operation_id: string;
  organizer_event_id: string;
  event_id: string | null;
  event_url: string | null;
  calendar_id: string | null;
  calendar_url: string | null;
  observed_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  artifact_ref: string | null;
  adapter_write_count: number;
};

export type TimeTreeAdapterRequest = {
  action: "create" | "update" | "delete";
  operationId: string;
  organizerEventId: string;
  idempotencyKey: string;
  calendar: { name: string; calendarId: string; url: string };
  payload: Record<string, unknown>;
  basePayload?: Record<string, unknown> | null;
  desiredHash: string;
  eventId?: string | null;
  eventUrl?: string | null;
  baseHash?: string | null;
};

type AdapterClientOptions = {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

function clientConfig(options: AdapterClientOptions) {
  const baseUrl = (options.baseUrl ?? process.env.TIMETREE_ADAPTER_BASE_URL ?? "http://api:8000").replace(/\/$/, "");
  const token = (options.token ?? process.env.TIMETREE_INTERNAL_API_TOKEN ?? "").trim();
  if (!token) throw new Error("TIMETREE_INTERNAL_API_TOKEN is required.");
  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("TIMETREE_ADAPTER_BASE_URL must use HTTP or HTTPS.");
  return { baseUrl, token, fetchImpl: options.fetchImpl ?? fetch };
}

export async function fetchTimeTreeAdapterStatus(options: AdapterClientOptions = {}): Promise<TimeTreeAdapterStatus> {
  const { baseUrl, token, fetchImpl } = clientConfig(options);
  const response = await fetchImpl(`${baseUrl}/internal/timetree/v1/status`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`TimeTree adapter status failed with HTTP ${response.status}.`);
  return response.json() as Promise<TimeTreeAdapterStatus>;
}

function wirePayload(payload: Record<string, unknown>) {
  return {
    organizer_event_id: payload.organizerEventId,
    ownership_marker: payload.ownershipMarker,
    title: payload.title,
    description: payload.description,
    start_at: payload.startAt,
    end_at: payload.endAt,
    all_day: payload.allDay,
    start_date: payload.startDate,
    end_date_exclusive: payload.endDateExclusive,
    location: payload.location
  };
}

export async function callTimeTreeAdapter(
  action: "create" | "reconcile" | "update" | "delete",
  request: TimeTreeAdapterRequest,
  options: AdapterClientOptions = {}
): Promise<TimeTreeAdapterResponse> {
  const { baseUrl, token, fetchImpl } = clientConfig(options);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (action !== "reconcile") headers["X-TimeTree-Write-Confirmation"] = "WRITE_TIMETREE";
  const response = await fetchImpl(`${baseUrl}/internal/timetree/v1/events/${action}`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      action: request.action,
      operation_id: request.operationId,
      organizer_event_id: request.organizerEventId,
      idempotency_key: request.idempotencyKey,
      calendar: {
        name: request.calendar.name,
        calendar_id: request.calendar.calendarId,
        url: request.calendar.url
      },
      payload: wirePayload(request.payload),
      base_payload: request.basePayload ? wirePayload(request.basePayload) : null,
      desired_hash: request.desiredHash,
      event_id: request.eventId ?? null,
      event_url: request.eventUrl ?? null,
      base_hash: request.baseHash ?? null
    })
  });
  if (!response.ok) throw new Error(`TimeTree adapter ${action} failed with HTTP ${response.status}.`);
  return response.json() as Promise<TimeTreeAdapterResponse>;
}
