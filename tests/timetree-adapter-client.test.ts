import assert from "node:assert/strict";
import test from "node:test";
import { fetchTimeTreeAdapterStatus } from "../lib/timetree/adapter-client";

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
