import { stripHtml } from "@/lib/utils/text";

export async function fetchArticleContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
      }
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const html = await response.text();
    const text = stripHtml(html);
    if (text.length < 200) return null;
    return text.slice(0, 12000);
  } catch {
    return null;
  }
}

