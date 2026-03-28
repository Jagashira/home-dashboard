import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { deleteStorageEntry } from "@/lib/storage";

function buildNoticePath(outcome: "success" | "error", notice: string) {
  const params = new URLSearchParams({ outcome, notice });
  return `/storage?${params.toString()}`;
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (code === "EROFS") {
      return "The storage directory is mounted read-only, so uploads and deletes are currently disabled.";
    }

    if (code === "EACCES" || code === "EPERM") {
      return "The app does not have permission to modify the storage directory.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  let destination = buildNoticePath("error", "Failed to delete the selected entry.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to delete the selected entry.";

  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "");
    const result = await deleteStorageEntry(name);
    revalidatePath("/storage");
    outcome = "success";
    message = result.message;
    destination = buildNoticePath("success", message);
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to delete the selected entry.");
    destination = buildNoticePath("error", message);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
