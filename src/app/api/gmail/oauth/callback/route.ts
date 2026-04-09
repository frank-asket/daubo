import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-origin";
import { parseGmailOAuthState } from "@/lib/gmail-oauth-state";

export const dynamic = "force-dynamic";

/** Google redirects here; exchanges code via Daubo API and stores refresh token server-side. */
export async function GET(req: NextRequest) {
  const origin = appOrigin();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/auth/sign-in", origin));
  }

  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?gmail=error&reason=${encodeURIComponent(err)}`, origin),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code?.trim() || !state?.trim()) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?gmail=error&reason=missing_code", origin),
    );
  }

  const secret = process.env.DAUBO_INTERNAL_API_SECRET?.trim();
  if (!secret) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=missing_config", origin));
  }

  let stateUserId: string;
  try {
    stateUserId = parseGmailOAuthState(state, secret).userId;
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=bad_state", origin));
  }
  if (stateUserId !== userId) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=user_mismatch", origin));
  }

  const apiBase = process.env.DAUBO_API_URL?.trim().replace(/\/+$/, "");
  if (!apiBase) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=missing_api", origin));
  }

  const r = await fetch(`${apiBase}/v1/me/integrations/gmail/oauth-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Daubo-Internal-Key": secret,
      "X-Daubo-User-Id": userId,
    },
    body: JSON.stringify({ code: code.trim() }),
    cache: "no-store",
  });

  if (!r.ok) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=api", origin));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?gmail=connected", origin));
}
