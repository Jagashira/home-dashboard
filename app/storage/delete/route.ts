import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { buildStoragePagePath, deleteStorageEntry, normalizeStorageLibrary } from "@/lib/storage";

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
  let destination = buildStoragePagePath("", "error", "Failed to delete the selected entry.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to delete the selected entry.";
  let parentPath = "";
  let library = normalizeStorageLibrary("storage");

  try {
    const formData = await request.formData();
    const relativePath = String(formData.get("path") ?? "");
    library = normalizeStorageLibrary(String(formData.get("library") ?? "storage"));
    parentPath = relativePath.split("/").slice(0, -1).join("/");
    const result = await deleteStorageEntry(relativePath, library);
    revalidatePath("/storage");
    outcome = "success";
    message = result.message;
    destination = buildStoragePagePath(parentPath, "success", message, library);
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to delete the selected entry.");
    destination = buildStoragePagePath(parentPath, "error", message, library);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
