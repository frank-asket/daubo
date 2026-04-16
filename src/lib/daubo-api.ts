/**
 * Browser calls: same-origin Daubo proxy (`/api/daubo/...`) keeps API credentials server-side.
 * Example: fetch(dauboBffUrl("v1/chat"), { method: "POST", ... })
 */
export function dauboBffUrl(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `/api/daubo/${trimmed}`;
}

/** FastAPI may return `detail` as a string or `{ message, code }` (e.g. idempotency 409). */
export function detailFromApiJson(j: unknown, fallback: string): string {
  const raw =
    j && typeof j === "object" && "detail" in j ? (j as { detail: unknown }).detail : undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return fallback;
}
