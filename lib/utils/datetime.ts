export function toIso(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function nowIso() {
  return new Date().toISOString();
}

