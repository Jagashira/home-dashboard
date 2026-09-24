export async function organizerFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "応答を読み取れませんでした。" }));
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? "処理に失敗しました。");
  return payload as T;
}

