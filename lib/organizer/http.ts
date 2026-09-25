import { NextResponse } from "next/server";
import { OrganizerConflictError, OrganizerValidationError } from "./validation";

export function organizerErrorResponse(error: unknown) {
  if (error instanceof OrganizerValidationError) {
    return NextResponse.json(
      { ok: false, error: error.message, fieldErrors: error.fieldErrors },
      { status: 400 }
    );
  }
  if (error instanceof OrganizerConflictError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2025") return NextResponse.json({ ok: false, error: "対象が見つかりません。" }, { status: 404 });
  console.error("ORGANIZER_API_ERROR", error);
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "処理に失敗しました。" },
    { status: 500 }
  );
}
