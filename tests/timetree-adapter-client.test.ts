import assert from "node:assert/strict";
import test from "node:test";
import { callTimeTreeAdapter, fetchTimeTreeAdapterStatus } from "../lib/timetree/adapter-client";

test("TimeTree adapter client uses authenticated read-only status request", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({
      authenticated: true,
      storage_state_exists: true,
      calendar_configured: true,
      calendar_found: true,
      calendar_name: "Partner",
      calendar_url: "https://timetreeapp.com/calendars/example",
      ready: true,
      adapter_write_count: 0
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const result = await fetchTimeTreeAdapterStatus({
    baseUrl: "http://api:8000/",
    token: "internal-secret",
    fetchImpl
  });
  assert.equal(request?.url, "http://api:8000/internal/timetree/v1/status");
  assert.equal(request?.init?.method, "GET");
  assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer internal-secret");
  assert.equal(result.adapter_write_count, 0);
});

test("TimeTree adapter client fails closed without a token", async () => {
  await assert.rejects(
    fetchTimeTreeAdapterStatus({ baseUrl: "http://api:8000", token: "" }),
    /TIMETREE_INTERNAL_API_TOKEN is required/
  );
});

test("TimeTree adapter client sends the canonical operation contract and a separate write confirmation", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      outcome: "verified", phase: "remote_verified", operation_id: body.operation_id,
      organizer_event_id: body.organizer_event_id, event_id: "remote-1",
      event_url: "https://timetreeapp.com/calendars/calendar-1/events/remote-1",
      calendar_id: "calendar-1", calendar_url: "https://timetreeapp.com/calendars/calendar-1",
      observed_hash: body.desired_hash, error_code: null, error_message: null,
      artifact_ref: null, adapter_write_count: 1
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const request = {
    action: "create" as const, operationId: "op-1", organizerEventId: "event-1",
    idempotencyKey: "event-1:create:hash",
    calendar: { name: "Partner", calendarId: "calendar-1", url: "https://timetreeapp.com/calendars/calendar-1" },
    payload: {
      organizerEventId: "event-1", ownershipMarker: "HOME_DASHBOARD_EVENT_ID:event-1",
      title: "Dinner", description: null, startAt: "2026-10-01T10:00:00.000Z",
      endAt: "2026-10-01T11:00:00.000Z", allDay: false,
      startDate: null, endDateExclusive: null, location: null
    },
    desiredHash: "a".repeat(64), eventId: null, eventUrl: null, baseHash: null
  };
  await callTimeTreeAdapter("create", request, { baseUrl: "http://api:8000", token: "secret", fetchImpl });
  assert.equal(captured?.url, "http://api:8000/internal/timetree/v1/events/create");
  const headers = captured?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer secret");
  assert.equal(headers["X-TimeTree-Write-Confirmation"], "WRITE_TIMETREE");
  const body = JSON.parse(String(captured?.init?.body));
  assert.equal(body.payload.ownership_marker, "HOME_DASHBOARD_EVENT_ID:event-1");
  assert.equal(body.calendar.calendar_id, "calendar-1");
});
