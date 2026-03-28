"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StorageCreateFolderFormProps = {
  currentPath: string;
  disabled: boolean;
};

export function StorageCreateFolderForm({ currentPath, disabled }: StorageCreateFolderFormProps) {
  const router = useRouter();
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled || isCreating) {
      return;
    }

    const trimmed = folderName.trim();
    if (!trimmed) {
      window.alert("Enter a folder name.");
      return;
    }

    setIsCreating(true);

    try {
      const formData = new FormData();
      formData.append("name", trimmed);
      formData.append("currentPath", currentPath);

      const response = await fetch("/storage/folders", {
        method: "POST",
        body: formData,
        headers: {
          "x-storage-client": "1"
        }
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to create the folder.");
      }

      setFolderName("");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create the folder.";
      window.alert(message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
      <input
        type="text"
        value={folderName}
        onChange={(event) => setFolderName(event.target.value)}
        placeholder="New folder"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        disabled={disabled || isCreating}
      />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isCreating}
      >
        {isCreating ? "Creating..." : "New Folder"}
      </button>
    </form>
  );
}
