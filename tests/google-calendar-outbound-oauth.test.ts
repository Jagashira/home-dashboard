import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GOOGLE_CALENDAR_OUTBOUND_SCOPE,
  createOutboundAuthorizationUrl,
  exchangeOutboundAuthorizationRedirect,
  outboundOAuthSessionPath,
  writeOutboundRefreshTokenToEnv
} from "../lib/google-calendar/outbound-oauth";
import { oauthSessionPath } from "../lib/google-calendar/oauth";
import { createGoogleCalendarOutboundClient } from "../lib/google-calendar/write-client";

class FakeOAuthClient {
  exchangedCode: string | null = null;
  exchangedVerifier: string | null = null;

  async generateCodeVerifierAsync() {
    return { codeVerifier: "private-pkce-verifier", codeChallenge: "public-pkce-challenge" };
  }

  generateAuthUrl(options: Record<string, unknown>) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("scope", (options.scope as string[]).join(" "));
    url.searchParams.set("state", String(options.state));
    url.searchParams.set("code_challenge", String(options.code_challenge));
    url.searchParams.set("code_challenge_method", String(options.code_challenge_method));
    return url.toString();
  }

  async getToken(options: { code: string; codeVerifier: string }) {
    this.exchangedCode = options.code;
    this.exchangedVerifier = options.codeVerifier;
    return { tokens: { refresh_token: "outbound-secret-token" } };
  }
}

function withGoogleOAuthEnv(run: () => Promise<void> | void) {
  const names = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_OUTBOUND_REFRESH_TOKEN"
  ] as const;
  const originals = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://developers.google.com/oauthplayground";
  process.env.GOOGLE_REFRESH_TOKEN = "inbound-readonly-token";
  delete process.env.GOOGLE_OUTBOUND_REFRESH_TOKEN;
  return Promise.resolve(run()).finally(() => {
    for (const name of names) {
      const value = originals[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test("outbound OAuth uses only the owned-events scope and a separate PKCE session", async () => {
  await withGoogleOAuthEnv(async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "google-outbound-oauth-"));
    try {
      const client = new FakeOAuthClient();
      const authorizationUrl = new URL(await createOutboundAuthorizationUrl(directory, client));
      assert.equal(GOOGLE_CALENDAR_OUTBOUND_SCOPE, "https://www.googleapis.com/auth/calendar.events.owned");
      assert.equal(authorizationUrl.searchParams.get("scope"), GOOGLE_CALENDAR_OUTBOUND_SCOPE);
      assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
      assert.equal(authorizationUrl.searchParams.get("code_challenge"), "public-pkce-challenge");
      assert.ok(authorizationUrl.searchParams.get("state"));
      assert.equal(authorizationUrl.toString().includes("private-pkce-verifier"), false);
      assert.notEqual(outboundOAuthSessionPath(directory), oauthSessionPath(directory));
      assert.match(outboundOAuthSessionPath(directory), /outbound-oauth-session\.json$/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test("outbound OAuth exchange writes only GOOGLE_OUTBOUND_REFRESH_TOKEN and returns no secret", async () => {
  await withGoogleOAuthEnv(async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "google-outbound-oauth-"));
    try {
      const envPath = path.join(directory, ".env");
      writeFileSync(envPath, "GOOGLE_REFRESH_TOKEN=inbound-token\nGOOGLE_OUTBOUND_REFRESH_TOKEN=old-outbound\nOTHER=value\n");
      const client = new FakeOAuthClient();
      const authorizationUrl = new URL(await createOutboundAuthorizationUrl(directory, client));
      const state = authorizationUrl.searchParams.get("state");
      const result = await exchangeOutboundAuthorizationRedirect(
        `https://developers.google.com/oauthplayground/?code=one-time-code&state=${encodeURIComponent(state!)}`,
        { baseDirectory: directory, envPath, client }
      );
      const updated = readFileSync(envPath, "utf8");
      assert.match(updated, /^GOOGLE_REFRESH_TOKEN=inbound-token$/m);
      assert.match(updated, /^GOOGLE_OUTBOUND_REFRESH_TOKEN=outbound-secret-token$/m);
      assert.equal(updated.includes("old-outbound"), false);
      assert.deepEqual(result, {
        scope: GOOGLE_CALENDAR_OUTBOUND_SCOPE,
        envUpdated: true,
        refreshTokenExposed: false
      });
      assert.equal(JSON.stringify(result).includes("outbound-secret-token"), false);
      assert.equal(JSON.stringify(result).includes("one-time-code"), false);
      assert.equal(client.exchangedCode, "one-time-code");
      assert.equal(client.exchangedVerifier, "private-pkce-verifier");
      assert.equal(readFileSync(envPath, "utf8").includes("GOOGLE_REFRESH_TOKEN=outbound-secret-token"), false);
      assert.throws(() => readFileSync(outboundOAuthSessionPath(directory), "utf8"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test("outbound OAuth rejects a mismatched state and an expired 15-minute session", async () => {
  await withGoogleOAuthEnv(async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "google-outbound-oauth-"));
    try {
      const envPath = path.join(directory, ".env");
      writeFileSync(envPath, "GOOGLE_REFRESH_TOKEN=inbound-token\n");
      const client = new FakeOAuthClient();
      const authorizationUrl = new URL(await createOutboundAuthorizationUrl(directory, client));
      const state = authorizationUrl.searchParams.get("state")!;
      await assert.rejects(
        exchangeOutboundAuthorizationRedirect(
          "https://developers.google.com/oauthplayground/?code=secret-code&state=wrong-state",
          { baseDirectory: directory, envPath, client }
        ),
        /stateが一致しません/
      );
      assert.equal(readFileSync(envPath, "utf8"), "GOOGLE_REFRESH_TOKEN=inbound-token\n");

      const sessionPath = outboundOAuthSessionPath(directory);
      const session = JSON.parse(readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
      session.createdAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
      writeFileSync(sessionPath, JSON.stringify(session));
      await assert.rejects(
        exchangeOutboundAuthorizationRedirect(
          `https://developers.google.com/oauthplayground/?code=secret-code&state=${encodeURIComponent(state)}`,
          { baseDirectory: directory, envPath, client }
        ),
        /有効期限が切れています/
      );
      assert.equal(client.exchangedCode, null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test("outbound token writer never overwrites the inbound token", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "google-outbound-env-"));
  try {
    const envPath = path.join(directory, ".env");
    writeFileSync(envPath, "GOOGLE_REFRESH_TOKEN=inbound-token\nOTHER=value\n");
    writeOutboundRefreshTokenToEnv("outbound-token", envPath);
    const updated = readFileSync(envPath, "utf8");
    assert.match(updated, /^GOOGLE_REFRESH_TOKEN=inbound-token$/m);
    assert.match(updated, /^GOOGLE_OUTBOUND_REFRESH_TOKEN=outbound-token$/m);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("write client requires the dedicated token, while explicit dry-run fallback remains available", async () => {
  await withGoogleOAuthEnv(async () => {
    assert.throws(() => createGoogleCalendarOutboundClient(), /GOOGLE_OUTBOUND_REFRESH_TOKEN is not set/);
    const dryRunClient = createGoogleCalendarOutboundClient({ allowReadOnlyFallbackForDryRun: true });
    await assert.rejects(
      dryRunClient.createEvent("calendar", {
        summary: "must not write",
        start: { dateTime: "2026-10-01T00:00:00.000Z", timeZone: "Asia/Tokyo" },
        end: { dateTime: "2026-10-01T01:00:00.000Z", timeZone: "Asia/Tokyo" },
        extendedProperties: { private: { homeDashboardEventId: "test-event" } }
      }),
      /GOOGLE_OUTBOUND_REFRESH_TOKEN is required/
    );
  });
});
