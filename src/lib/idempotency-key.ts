/** Client-generated key for mutating API calls (matches autopilot / approvals idempotency). */
export function makeIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
