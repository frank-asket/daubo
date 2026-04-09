/**
 * Browser calls: same-origin Daubo proxy (`/api/daubo/...`) keeps API credentials server-side.
 * Example: fetch(dauboBffUrl("v1/chat"), { method: "POST", ... })
 */
export function dauboBffUrl(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `/api/daubo/${trimmed}`;
}
