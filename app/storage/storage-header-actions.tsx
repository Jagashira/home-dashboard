"use client";

import { useEffect, useRef, useState } from "react";
import { StorageCreateFolderForm } from "@/app/storage/storage-create-folder-form";
import { StorageUploadForm } from "@/app/storage/storage-upload-form";

type StorageHeaderActionsProps = {
  currentPath: string;
  disabled: boolean;
  initialNotice?: {
    message: string;
    outcome?: string;
  } | null;
};

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
      <path d="M12 3l4.5 4.5-1.4 1.4-2.1-2.1V15h-2V6.8L8.9 8.9 7.5 7.5zm-7 13h14v4H5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
    </svg>
  );
}

export function StorageHeaderActions({
  currentPath,
  disabled,
  initialNotice
}: StorageHeaderActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<"upload" | "folder" | "mobile" | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !rootRef.current.contains(target)) {
        setOpenPanel(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <div className="hidden items-center gap-3 md:flex">
        <button
          type="button"
          onClick={() => setOpenPanel((current) => (current === "upload" ? null : "upload"))}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-base font-medium transition hover:bg-white/16"
        >
          <UploadIcon />
          Upload
        </button>

        <button
          type="button"
          onClick={() => setOpenPanel((current) => (current === "folder" ? null : "folder"))}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-base font-medium transition hover:bg-white/16"
        >
          <PlusIcon />
          New Folder
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpenPanel((current) => (current === "mobile" ? null : "mobile"))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white md:hidden"
      >
        <PlusIcon />
      </button>

      {openPanel === "upload" ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-20 hidden w-[520px] rounded-[22px] border border-white/15 bg-[rgba(44,108,233,0.96)] p-4 shadow-2xl shadow-blue-950/20 backdrop-blur md:block">
          <StorageUploadForm
            currentPath={currentPath}
            disabled={disabled}
            compact
            initialNotice={initialNotice}
          />
        </div>
      ) : null}

      {openPanel === "folder" ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-20 hidden w-[430px] rounded-[22px] border border-white/15 bg-[rgba(44,108,233,0.96)] p-4 shadow-2xl shadow-blue-950/20 backdrop-blur md:block">
          <StorageCreateFolderForm currentPath={currentPath} disabled={disabled} compact />
        </div>
      ) : null}

      {openPanel === "mobile" ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-[min(92vw,360px)] space-y-3 rounded-[22px] border border-white/15 bg-[rgba(44,108,233,0.96)] p-3 shadow-2xl shadow-blue-950/20 backdrop-blur md:hidden">
          <StorageUploadForm
            currentPath={currentPath}
            disabled={disabled}
            compact
            initialNotice={initialNotice}
          />
          <StorageCreateFolderForm currentPath={currentPath} disabled={disabled} compact />
        </div>
      ) : null}
    </div>
  );
}
