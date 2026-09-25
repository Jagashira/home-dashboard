import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { google } from "googleapis";

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const SESSION_MAX_AGE_MS = 15 * 60 * 1000;

type OAuthSession = {
  stateHash: string;
  codeVerifier: string;
  createdAt: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function oauthClient() {
  return new google.auth.OAuth2(
    required("GOOGLE_CLIENT_ID"),
    required("GOOGLE_CLIENT_SECRET"),
    required("GOOGLE_REDIRECT_URI")
  );
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function oauthSessionPath(baseDirectory = process.cwd()) {
  return path.join(baseDirectory, "data", "google-calendar", "oauth-session.json");
}

export async function createReadOnlyAuthorizationUrl(baseDirectory = process.cwd()) {
  const client = oauthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const state = randomBytes(24).toString("base64url");
  const file = oauthSessionPath(baseDirectory);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const session: OAuthSession = { stateHash: digest(state), codeVerifier, createdAt: new Date().toISOString() };
  writeFileSync(file, `${JSON.stringify(session)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: false,
    scope: [GOOGLE_CALENDAR_READONLY_SCOPE],
    state,
    // google-auth-library types this as an enum, while googleapis does not re-export that enum.
    code_challenge_method: "S256" as never,
    code_challenge: codeChallenge
  });
}

export function writeRefreshTokenToEnv(refreshToken: string, envPath = path.resolve(process.cwd(), ".env")) {
  if (!refreshToken || /[\r\n]/.test(refreshToken)) throw new Error("Invalid refresh token");
  const current = readFileSync(envPath, "utf8");
  const line = `GOOGLE_REFRESH_TOKEN=${refreshToken}`;
  const next = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
    : `${current.replace(/\s*$/, "\n")}${line}\n`;
  const temporary = `${envPath}.google-calendar.tmp`;
  writeFileSync(temporary, next, { mode: 0o600 });
  renameSync(temporary, envPath);
  chmodSync(envPath, 0o600);
}

export async function exchangeReadOnlyAuthorizationRedirect(
  redirectUrl: string,
  options: { baseDirectory?: string; envPath?: string } = {}
) {
  const expectedRedirect = new URL(required("GOOGLE_REDIRECT_URI"));
  const received = new URL(redirectUrl);
  if (received.origin !== expectedRedirect.origin || received.pathname !== expectedRedirect.pathname) {
    throw new Error("Redirect URL does not match GOOGLE_REDIRECT_URI");
  }
  const oauthError = received.searchParams.get("error");
  if (oauthError) throw new Error(`Google authorization failed: ${oauthError}`);
  const code = received.searchParams.get("code");
  const state = received.searchParams.get("state");
  if (!code || !state) throw new Error("Redirect URLにcode/stateがありません。");

  const baseDirectory = options.baseDirectory ?? process.cwd();
  const file = oauthSessionPath(baseDirectory);
  const session = JSON.parse(readFileSync(file, "utf8")) as OAuthSession;
  const createdAt = new Date(session.createdAt);
  if (Number.isNaN(createdAt.getTime()) || Date.now() - createdAt.getTime() > SESSION_MAX_AGE_MS) {
    throw new Error("OAuth sessionの有効期限が切れています。auth-urlを再実行してください。");
  }
  if (!safeEqualHex(digest(state), session.stateHash)) throw new Error("OAuth stateが一致しません。");

  const client = oauthClient();
  const { tokens } = await client.getToken({ code, codeVerifier: session.codeVerifier });
  if (!tokens.refresh_token) {
    throw new Error("refresh tokenが返りませんでした。Googleの同意画面で再承認してください。");
  }
  writeRefreshTokenToEnv(tokens.refresh_token, options.envPath);
  rmSync(file, { force: true });
  return { scope: GOOGLE_CALENDAR_READONLY_SCOPE, envUpdated: true, refreshTokenExposed: false };
}
