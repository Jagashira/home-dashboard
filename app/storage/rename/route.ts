import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { buildStoragePagePath, renameStorageEntry } from "@/lib/storage";

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (code === "EEXIST") {
      return "An item with the same name already exists.";
    }

    if (code === "EACCES" || code === "EPERM") {
      return "The app does not have permission to modify the storage directory.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  let destination = buildStoragePagePath("", "error", "Failed to rename the selected entry.");
  let outcome: "success" | "error" = "error";
  let message = "Failed to rename the selected entry.";
  let parentPath = "";

  try {
    const formData = await request.formData();
    const relativePath = String(formData.get("path") ?? "");
    parentPath = relativePath.split("/").slice(0, -1).join("/");
    const nextName = String(formData.get("name") ?? "");
    const result = await renameStorageEntry(relativePath, nextName);
    revalidatePath("/storage");
    outcome = "success";
    message = result.message;
    destination = buildStoragePagePath(parentPath, "success", message);
  } catch (error) {
    message = getActionErrorMessage(error, "Failed to rename the selected entry.");
    destination = buildStoragePagePath(parentPath, "error", message);
  }

  if (request.headers.get("x-storage-client") === "1") {
    return NextResponse.json({ outcome, message }, { status: outcome === "success" ? 200 : 400 });
  }

  redirect(destination);
}
