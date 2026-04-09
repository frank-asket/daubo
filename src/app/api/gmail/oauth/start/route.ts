import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-origin";
import { buildGmailOAuthState } from "@/lib/gmail-oauth-state";

export const dynamic = "force-dynamic";

const GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";

/**
 * Starts Google OAuth for Gmail compose (drafts). Requires DAUBO_INTERNAL_API_SECRET and
 * GOOGLE_OAUTH_CLIENT_ID on Vercel; redirect URI must match Google Cloud and Railway GOOGLE_OAUTH_REDIRECT_URI.
 */
export async function GET() {
  const { userId } = await auth();
  const origin = appOrigin();
  if (!userId) {
    return NextResponse.redirect(new URL("/auth/sign-in", origin));
  }

  const secret = process.env.DAUBO_INTERNAL_API_SECRET?.trim();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!secret || !clientId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?gmail=missing_config", origin),
    );
  }

  const redirectUri = `${origin}/api/gmail/oauth/callback`;
  const state = buildGmailOAuthState(userId, secret);
  const scope = encodeURIComponent(GMAIL_COMPOSE);
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
