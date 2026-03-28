"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type StorageUploadFormProps = {
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

export function StorageUploadForm({ disabled, initialNotice }: StorageUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({
    progress: 0,
    isUploading: false,
    message: initialNotice?.message ?? null,
    outcome: initialNotice?.outcome === "success" ? "success" : initialNotice?.message ? "error" : null
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled || state.isUploading) {
      return;
    }

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({
        progress: 0,
        isUploading: false,
        message: "Choose a file to upload.",
        outcome: "error"
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/storage/upload");
    request.setRequestHeader("x-storage-client", "1");

    request.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        return;
      }

      const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      setState((current) => ({
        ...current,
        progress,
        isUploading: true,
        message: `Uploading ${file.name}... ${progress}%`,
        outcome: null
      }));
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
        (outcome === "success" ? `Uploaded ${file.name}.` : "Failed to upload the selected file.");

      setState({
        progress: outcome === "success" ? 100 : 0,
        isUploading: false,
        message,
        outcome
      });

      if (outcome === "success" && inputRef.current) {
        inputRef.current.value = "";
        router.refresh();
      }
    });

    request.addEventListener("error", () => {
      setState({
        progress: 0,
        isUploading: false,
        message: "Network error while uploading the file.",
        outcome: "error"
      });
    });

    request.addEventListener("loadstart", () => {
      setState({
        progress: 0,
        isUploading: true,
        message: `Starting upload for ${file.name}...`,
        outcome: null
      });
    });

    request.send(formData);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Upload File</h2>
        <p className="text-sm leading-6 text-slate-600">
          Uploads are stored directly under the configured base directory. Existing file names are
          protected from overwrite.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          ref={inputRef}
          type="file"
          name="file"
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
    </div>
  );
}
