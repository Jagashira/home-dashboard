import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getGmailOAuthClient,
  saveGmailConnection,
  validateGmailOAuthState
} from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const redirectBase = new URL("/job-hunting", request.url);

  try {
    const stateValid = await validateGmailOAuthState(state);
    if (!stateValid) {
      redirectBase.searchParams.set("gmail", "state_error");
      return NextResponse.redirect(redirectBase);
    }

    if (!code) {
      redirectBase.searchParams.set("gmail", "missing_code");
      return NextResponse.redirect(redirectBase);
    }

    const auth = getGmailOAuthClient();
    const { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token) {
      redirectBase.searchParams.set("gmail", "missing_refresh_token");
      return NextResponse.redirect(redirectBase);
    }

    auth.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" }).catch(() => null);

    saveGmailConnection({
      email: profile?.data.emailAddress || null,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope || null
    });

    redirectBase.searchParams.set("gmail", "connected");
    return NextResponse.redirect(redirectBase);
  } catch {
    redirectBase.searchParams.set("gmail", "auth_error");
    return NextResponse.redirect(redirectBase);
  }
}
