import { Readable } from "node:stream";
import { getStorageFileStream } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    name: string;
  }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { name } = await params;
    const file = await getStorageFileStream(name);

    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        "Content-Length": String(file.size),
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open file.";
    return new Response(message, { status: 404 });
  }
}
