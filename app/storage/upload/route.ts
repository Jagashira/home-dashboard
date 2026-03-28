import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uploadStorageFile } from "@/lib/storage";

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
  let destination = buildNoticePath("error", "Failed to upload the file.");

  try {
    const formData = await request.formData();
    const selected = formData.get("file");

    if (!(selected instanceof File)) {
      destination = buildNoticePath("error", "Choose a file to upload.");
    } else {
      const result = await uploadStorageFile(selected);
      revalidatePath("/storage");
      destination = buildNoticePath("success", result.message);
    }
  } catch (error) {
    const message = getActionErrorMessage(error, "Failed to upload the file.");
    destination = buildNoticePath("error", message);
  }

  redirect(destination);
}
