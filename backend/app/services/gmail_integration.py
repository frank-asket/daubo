"""Gmail API: OAuth code exchange, refresh, and draft creation (gmail.compose scope)."""

from __future__ import annotations

import base64
import logging
from email.message import EmailMessage
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger("daubo")

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts"


def gmail_oauth_configured(settings: Settings) -> bool:
    return bool(
        settings.google_oauth_client_id.strip()
        and settings.google_oauth_client_secret.strip()
        and settings.google_oauth_redirect_uri.strip(),
    )


async def exchange_authorization_code(
    settings: Settings,
    code: str,
) -> dict[str, Any]:
    if not gmail_oauth_configured(settings):
        raise ValueError("Google OAuth is not configured on the API")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code.strip(),
                "client_id": settings.google_oauth_client_id.strip(),
                "client_secret": settings.google_oauth_client_secret.strip(),
                "redirect_uri": settings.google_oauth_redirect_uri.strip(),
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=60.0,
        )
    if resp.status_code >= 400:
        logger.warning("Google token exchange failed: %s %s", resp.status_code, resp.text[:500])
        resp.raise_for_status()
    return resp.json()


async def refresh_access_token(settings: Settings, refresh_token: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_oauth_client_id.strip(),
                "client_secret": settings.google_oauth_client_secret.strip(),
                "refresh_token": refresh_token.strip(),
                "grant_type": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=60.0,
        )
    if resp.status_code >= 400:
        logger.warning("Google refresh failed: %s %s", resp.status_code, resp.text[:500])
        resp.raise_for_status()
    data = resp.json()
    token = data.get("access_token")
    if not isinstance(token, str):
        raise RuntimeError("No access_token in refresh response")
    return token


async def fetch_google_email(access_token: str) -> str | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
    if resp.status_code >= 400:
        return None
    data = resp.json()
    email = data.get("email")
    return email.strip() if isinstance(email, str) else None


def _rfc822_raw(subject: str, body: str, to: str | None) -> str:
    msg = EmailMessage()
    msg["Subject"] = subject.strip()[:900] if subject else "(no subject)"
    if to and to.strip():
        msg["To"] = to.strip()[:320]
    msg.set_content(body if body.strip() else " ", subtype="plain", charset="utf-8")
    return base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")


async def create_draft_plain(
    settings: Settings,
    refresh_token: str,
    subject: str,
    body: str,
    to: str | None = None,
) -> dict[str, Any]:
    access = await refresh_access_token(settings, refresh_token)
    raw = _rfc822_raw(subject, body, to)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GMAIL_DRAFTS_URL,
            headers={
                "Authorization": f"Bearer {access}",
                "Content-Type": "application/json",
            },
            json={"message": {"raw": raw}},
            timeout=60.0,
        )
    if resp.status_code >= 400:
        logger.warning("Gmail draft create failed: %s %s", resp.status_code, resp.text[:800])
        resp.raise_for_status()
    return resp.json()
