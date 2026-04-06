import crypto from "node:crypto";
import { cookies } from "next/headers";
import { gmail_v1, google } from "googleapis";
import { APP_CONFIG } from "@/lib/config";
import { getDb } from "@/lib/db";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const GMAIL_STATE_COOKIE = "gmail_oauth_state";
const GMAIL_REDIRECT_FALLBACK_PATH = "/api/gmail/auth/callback";

type GmailConnectionRow = {
  id: number;
  email: string | null;
  refresh_token: string;
  scope: string | null;
  connected_at: string;
  updated_at: string;
};

type GmailPresetCount = {
  label: string;
  query: string;
  count: number;
};

export type GmailSummary = {
  connected: boolean;
  email: string | null;
  unreadCount: number;
  inboxUnreadCount: number;
  presetCounts: GmailPresetCount[];
  updatedAt: string | null;
};

function ensureGmailSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS gmail_connections (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT,
      refresh_token TEXT NOT NULL,
      scope TEXT,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getGmailRedirectUri() {
  return process.env.GMAIL_REDIRECT_URI?.trim() || `${APP_CONFIG.appBaseUrl}${GMAIL_REDIRECT_FALLBACK_PATH}`;
}

export function getGmailOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv("GOOGLE_CLIENT_ID"),
    getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    getGmailRedirectUri()
  );
}

export async function createGmailAuthUrl() {
  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: APP_CONFIG.appBaseUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10
  });

  const auth = getGmailOAuthClient();
  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state
  });
}

export async function validateGmailOAuthState(state: string | null) {
  const cookieStore = await cookies();
  const savedState = cookieStore.get(GMAIL_STATE_COOKIE)?.value ?? null;
  cookieStore.delete(GMAIL_STATE_COOKIE);
  return Boolean(state && savedState && state === savedState);
}

export function saveGmailConnection(input: {
  email: string | null;
  refreshToken: string;
  scope: string | null;
}) {
  ensureGmailSchema();
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO gmail_connections(id, email, refresh_token, scope, connected_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        refresh_token = excluded.refresh_token,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `
  ).run(input.email, input.refreshToken, input.scope, now, now);
}

export function getStoredGmailConnection() {
  ensureGmailSchema();
  const db = getDb();
  return db
    .prepare(
      "SELECT id, email, refresh_token, scope, connected_at, updated_at FROM gmail_connections WHERE id = 1"
    )
    .get() as GmailConnectionRow | undefined;
}

export function clearGmailConnection() {
  ensureGmailSchema();
  const db = getDb();
  db.prepare("DELETE FROM gmail_connections WHERE id = 1").run();
}

async function getAuthorizedGmailClient() {
  const connection = getStoredGmailConnection();
  if (!connection?.refresh_token) {
    return null;
  }

  const auth = getGmailOAuthClient();
  auth.setCredentials({ refresh_token: connection.refresh_token });
  return { auth, connection };
}

async function estimateQueryCount(gmail: gmail_v1.Gmail, query: string) {
  const result = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 1
  });
  return result.data.resultSizeEstimate ?? 0;
}

export async function fetchGmailSummary(
  presets: Array<{ label: string; query: string }>
): Promise<GmailSummary> {
  const authorized = await getAuthorizedGmailClient();
  if (!authorized) {
    return {
      connected: false,
      email: null,
      unreadCount: 0,
      inboxUnreadCount: 0,
      presetCounts: presets.map((preset) => ({ ...preset, count: 0 })),
      updatedAt: null
    };
  }

  const gmail = google.gmail({ version: "v1", auth: authorized.auth });
  const profilePromise = gmail.users.getProfile({ userId: "me" }).catch(() => null);

  const [profile, unreadEstimate, inboxUnreadEstimate, presetCounts] = await Promise.all([
    profilePromise,
    estimateQueryCount(gmail, "is:unread"),
    estimateQueryCount(gmail, "in:inbox is:unread"),
    Promise.all(
      presets.map(async (preset) => ({
        ...preset,
        count: await estimateQueryCount(gmail, preset.query)
      }))
    )
  ]);

  return {
    connected: true,
    email: profile?.data.emailAddress || authorized.connection.email || null,
    unreadCount: unreadEstimate,
    inboxUnreadCount: inboxUnreadEstimate,
    presetCounts,
    updatedAt: authorized.connection.updated_at
  };
}
