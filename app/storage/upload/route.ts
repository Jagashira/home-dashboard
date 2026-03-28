import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { buildStoragePagePath, normalizeStoragePath, uploadStorageFile } from "@/lib/storage";

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
  let destination = buildStoragePagePath("", "error", "Failed to upload the file.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to upload the file.";
  let currentPath = "";

  try {
    const formData = await request.formData();
    const selected = formData.get("file");
    currentPath = normalizeStoragePath(String(formData.get("currentPath") ?? ""));

    if (!(selected instanceof File)) {
      message = "Choose a file to upload.";
      destination = buildStoragePagePath(currentPath, "error", message);
    } else {
      const result = await uploadStorageFile(selected, currentPath);
      revalidatePath("/storage");
      outcome = "success";
      message = result.message;
      destination = buildStoragePagePath(currentPath, "success", message);
    }
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to upload the file.");
    destination = buildStoragePagePath(currentPath, "error", message);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
