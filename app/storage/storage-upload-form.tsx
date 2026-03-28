"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type StorageUploadFormProps = {
  currentPath: string;
  disabled: boolean;
  initialNotice?: {
    message: string;
    outcome?: string;
  } | null;
};

type UploadState = {
  progress: number;
  isUploading: boolean;
  message: string | null;
  outcome: "success" | "error" | null;
};

function getNoticeTone(outcome: UploadState["outcome"]) {
  if (outcome === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-900";
}

export function StorageUploadForm({ currentPath, disabled, initialNotice }: StorageUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [state, setState] = useState<UploadState>({
    progress: 0,
    isUploading: false,
    message: initialNotice?.message ?? null,
    outcome: initialNotice?.outcome === "success" ? "success" : initialNotice?.message ? "error" : null
  });

  function uploadSingleFile(file: File, index: number, total: number) {
    return new Promise<{ outcome: "success" | "error"; message: string }>((resolve) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("currentPath", currentPath);

      const request = new XMLHttpRequest();
      request.open("POST", "/storage/upload");
      request.setRequestHeader("x-storage-client", "1");

      request.upload.addEventListener("progress", (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }

        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setState({
          progress,
          isUploading: true,
          message: `Uploading ${index + 1}/${total}: ${file.name}... ${progress}%`,
          outcome: null
        });
      });

      request.addEventListener("load", () => {
        let payload: { message?: string; outcome?: "success" | "error" } = {};

        try {
          payload = JSON.parse(request.responseText) as typeof payload;
        } catch {
          payload = {};
        }

        const outcome = request.status >= 200 && request.status < 300 ? payload.outcome ?? "success" : "error";
        const message =
          payload.message ??
          (outcome === "success" ? `Uploaded ${file.name}.` : `Failed to upload ${file.name}.`);

        resolve({ outcome, message });
      });

      request.addEventListener("error", () => {
        resolve({
          outcome: "error",
          message: `Network error while uploading ${file.name}.`
        });
      });

      request.addEventListener("loadstart", () => {
        setState({
          progress: 0,
          isUploading: true,
          message: `Starting upload ${index + 1}/${total}: ${file.name}...`,
          outcome: null
        });
      });

      request.send(formData);
    });
  }

  async function uploadFiles(files: File[]) {
    if (disabled || state.isUploading) {
      return;
    }

    if (!files.length) {
      setState({
        progress: 0,
        isUploading: false,
        message: "Choose a file to upload.",
        outcome: "error"
      });
      return;
    }

    let successCount = 0;
    const failures: string[] = [];

    for (const [index, file] of files.entries()) {
      const result = await uploadSingleFile(file, index, files.length);
      if (result.outcome === "success") {
        successCount += 1;
      } else {
        failures.push(result.message);
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    router.refresh();

    setState({
      progress: successCount === files.length ? 100 : 0,
      isUploading: false,
      message:
        failures.length === 0
          ? `Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`
          : `Uploaded ${successCount}/${files.length} file(s). ${failures[0]}`,
      outcome: failures.length === 0 ? "success" : "error"
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void uploadFiles(Array.from(inputRef.current?.files ?? []));
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);

    if (disabled || state.isUploading) {
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);
    void uploadFiles(files);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled && !state.isUploading) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragActive(false);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isDragActive ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-50"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Upload File</h2>
        <p className="text-sm leading-6 text-slate-600">
          Upload files directly into the current folder. Existing file names are protected from
          overwrite, and you can also drag files here like a simple drive drop zone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          ref={inputRef}
          type="file"
          name="file"
          multiple
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          disabled={disabled || state.isUploading}
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled || state.isUploading}
        >
          {state.isUploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {state.isUploading ? (
        <div className="mt-4 space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-[width] duration-200"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-sm text-slate-600">{state.message}</p>
        </div>
      ) : null}

      {state.message && !state.isUploading ? (
        <div className={`mt-4 rounded-xl border p-4 text-sm font-medium ${getNoticeTone(state.outcome)}`}>
          {state.message}
        </div>
      ) : null}

      {!state.isUploading ? (
        <p className="mt-3 text-xs text-slate-500">Tip: drop multiple files here to upload them in sequence.</p>
      ) : null}
    </div>
  );
}
