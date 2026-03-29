import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  buildStoragePagePath,
  moveStorageEntries,
  normalizeStorageLibrary,
  normalizeStoragePath
} from "@/lib/storage";

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (code === "EACCES" || code === "EPERM") {
      return "The app does not have permission to modify the storage directory.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  let destination = buildStoragePagePath("", "error", "Failed to move the selected entries.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to move the selected entries.";
  let targetPath = "";
  let library = normalizeStorageLibrary("storage");

  try {
    const formData = await request.formData();
    const paths = formData.getAll("paths").map((item) => String(item));
    library = normalizeStorageLibrary(String(formData.get("library") ?? "storage"));
    targetPath = normalizeStoragePath(String(formData.get("targetPath") ?? ""));
    const result = await moveStorageEntries(paths, targetPath, library);
    revalidatePath("/storage");
    outcome = "success";
    message = result.message;
    destination = buildStoragePagePath(targetPath, "success", message, library);
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to move the selected entries.");
    destination = buildStoragePagePath(targetPath, "error", message, library);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
