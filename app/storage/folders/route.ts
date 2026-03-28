import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { buildStoragePagePath, createStorageDirectory, normalizeStoragePath } from "@/lib/storage";

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (code === "EROFS") {
      return "The storage directory is mounted read-only, so folder creation is currently disabled.";
    }

    if (code === "EEXIST") {
      return "A folder with the same name already exists.";
    }

    if (code === "EACCES" || code === "EPERM") {
      return "The app does not have permission to modify the storage directory.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  let destination = buildStoragePagePath("", "error", "Failed to create the folder.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to create the folder.";

  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "");
    const currentPath = normalizeStoragePath(String(formData.get("currentPath") ?? ""));
    const result = await createStorageDirectory(name, currentPath);
    revalidatePath("/storage");
    outcome = "success";
    message = result.message;
    destination = buildStoragePagePath(currentPath, "success", message);
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to create the folder.");
    destination = buildStoragePagePath("", "error", message);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
