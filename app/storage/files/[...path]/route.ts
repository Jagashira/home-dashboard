import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getStorageFileStream, normalizeStorageLibrary } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    path: string[];
  }>;
};

function parseRangeHeader(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());

  if (!match) {
    return null;
  }

  const startRaw = match[1];
  const endRaw = match[2];

  let start = startRaw ? Number.parseInt(startRaw, 10) : Number.NaN;
  let end = endRaw ? Number.parseInt(endRaw, 10) : Number.NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return null;
  }

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else if (Number.isNaN(end)) {
    end = size - 1;
  }

  if (start < 0 || end < start || start >= size) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1)
  };
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const { path } = await params;
    const relativePath = path.join("/");
    const library = normalizeStorageLibrary(new URL(request.url).searchParams.get("library"));
    const file = await getStorageFileStream(relativePath, library);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, file.size);

      if (!range) {
        return new Response("Requested range is not satisfiable.", {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${file.size}`,
            "Cache-Control": "no-store"
          }
        });
      }

      const chunkSize = range.end - range.start + 1;
      file.stream.destroy();
      const partialStream = createReadStream(file.filePath, { start: range.start, end: range.end });

      return new Response(Readable.toWeb(partialStream) as ReadableStream, {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
          "Content-Type": file.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(relativePath.split("/").at(-1) ?? "file")}"`,
          "Cache-Control": "no-store"
        }
      });
    }

    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(file.size),
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(relativePath.split("/").at(-1) ?? "file")}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open file.";
    return new Response(message, { status: 404 });
  }
}
