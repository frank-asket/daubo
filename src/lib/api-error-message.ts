/**
 * Turn FastAPI-style `detail` (string | validation object[]) into a single readable message.
 */
export function formatApiErrorMessage(detail: unknown, fallback: string): string {
  if (detail == null) return fallback;
  if (typeof detail === "string") {
    const t = detail.trim();
    return t || fallback;
  }
  if (Array.isArray(detail)) {
    const parts: string[] = [];
    for (const item of detail) {
      if (item != null && typeof item === "object" && "msg" in item) {
        const m = (item as { msg?: unknown }).msg;
        if (typeof m === "string" && m.trim()) parts.push(m.trim());
      }
    }
    if (parts.length) return parts.join(" ");
  }
  if (typeof detail === "object" && detail !== null && "msg" in detail) {
    const m = (detail as { msg?: unknown }).msg;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return fallback;
}
