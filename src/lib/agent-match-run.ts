/**
 * Count structured listings from GET /v1/me/agent-match/latest `run` payload.
 * Returns null when there is no completed run (`run` is null).
 */
export function countParsedListingsFromRun(run: unknown): number | null {
  if (run == null) return null;
  if (typeof run !== "object") return null;
  const result = (run as { result?: { parsed_listings?: unknown } }).result;
  const list = result?.parsed_listings;
  if (!Array.isArray(list)) return 0;
  return list.length;
}
