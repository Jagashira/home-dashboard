export function dedupeByUrl<T extends { url: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!item.url) continue;
    if (!map.has(item.url)) map.set(item.url, item);
  }
  return [...map.values()];
}

