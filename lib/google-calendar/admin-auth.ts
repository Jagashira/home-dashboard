import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export class GoogleCalendarAdminAuthError extends Error {}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function requireGoogleCalendarAdmin(request: NextRequest) {
  const expected = process.env.GOOGLE_CALENDAR_ADMIN_SECRET?.trim();
  if (!expected) throw new GoogleCalendarAdminAuthError("GOOGLE_CALENDAR_ADMIN_SECRET is not configured");
  const provided = request.headers.get("x-google-calendar-admin-secret") ?? "";
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    throw new GoogleCalendarAdminAuthError("Unauthorized");
  }
}
