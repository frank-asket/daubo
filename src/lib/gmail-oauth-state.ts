import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** HMAC-signed state: binds OAuth round-trip to a Clerk user id and expiry. */
export function buildGmailOAuthState(userId: string, secret: string): string {
  if (!secret) throw new Error("OAuth state secret is not configured");
  const exp = Date.now() + 10 * 60 * 1000;
  const n = randomBytes(8).toString("hex");
  const payload = JSON.stringify({ u: userId, exp, n });
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${b64}.${sig}`;
}

export function parseGmailOAuthState(state: string, secret: string): { userId: string } {
  if (!secret) throw new Error("OAuth state secret is not configured");
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("Invalid state");
  const [b64, sig] = parts;
  if (!b64 || !sig) throw new Error("Invalid state");
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid state encoding");
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Bad state signature");
  const j = JSON.parse(payload) as { u?: string; exp?: number; n?: string };
  if (!j.u || typeof j.exp !== "number") throw new Error("Invalid state payload");
  if (Date.now() > j.exp) throw new Error("State expired");
  return { userId: j.u };
}
