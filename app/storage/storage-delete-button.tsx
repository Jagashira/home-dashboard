"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StorageDeleteButtonProps = {
  name: string;
};

export function StorageDeleteButton({ name }: StorageDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(`Delete "${name}"?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const formData = new FormData();
      formData.append("name", name);

      const response = await fetch("/storage/delete", {
        method: "POST",
        body: formData,
        headers: {
          "x-storage-client": "1"
        }
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to delete the selected entry.");
      }

      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete the selected entry.";
      window.alert(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
