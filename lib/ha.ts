import { NextRequest } from "next/server";
import { APP_CONFIG } from "@/lib/config";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

export type HomeAssistantNotificationAction = {
  action: "URI";
  title: string;
  uri: string;
};

export function isAuthorizedHomeAssistantRequest(request: NextRequest) {
  if (!APP_CONFIG.haSecret) return true;
  const token = request.headers.get("x-ha-secret") || request.nextUrl.searchParams.get("secret") || "";
  return token === APP_CONFIG.haSecret;
}

export function getTokyoDateString(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function buildUriAction(title: string, uri: string): HomeAssistantNotificationAction {
  return {
    action: "URI",
    title,
    uri
  };
}

export function formatYen(amount: number) {
  return new Intl.NumberFormat("ja-JP").format(Math.max(0, Math.round(amount)));
}
