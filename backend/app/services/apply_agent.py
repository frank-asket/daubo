"""Post-approval apply handoff: Gmail draft creation and LinkedIn copy/open guidance.

ApplyAgent logic lives in services (no HTTP); routers call into this module.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..models import JobApplication, UserGmailCredentials
from .gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    gmail_oauth_configured,
)

logger = logging.getLogger("daubo")

GMAIL_DRAFT_FAILED_USER_MESSAGE = (
    "Gmail draft was not created. Open Gmail settings, reconnect your account, then approve again "
    "or use “Create draft in Gmail” from the handoff panel."
)


def build_linkedin_handoff_payload(
    *,
    title: str,
    company: str,
    job_url: str | None,
    package_draft: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Structured handoff for LinkedIn channel (manual paste — no auto-send)."""
    pkg = package_draft if isinstance(package_draft, dict) else {}
    note = pkg.get("linkedin_note")
    cover = pkg.get("cover_letter")
    text = ""
    if isinstance(note, str) and note.strip():
        text = note.strip()
    elif isinstance(cover, str) and cover.strip():
        text = cover.strip()
    if not text:
        return None
    out: dict[str, Any] = {
        "note_text": text,
        "job_url": job_url.strip() if isinstance(job_url, str) and job_url.strip() else None,
        "context_line": f"{title} — {company}",
    }
    return out


async def try_create_gmail_draft_after_approval(
    settings: Settings,
    session: AsyncSession,
    *,
    user_id: str,
    app: JobApplication,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    If email channel prerequisites are met, create a Gmail draft. Returns
    (gmail_draft_dict_for_schema, user_visible_warning_or_none).
    gmail_draft_dict matches GmailDraftOut: draft_id, gmail_web_url.
    """
    if not gmail_oauth_configured(settings):
        return None, None

    creds = (
        await session.execute(
            select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
        )
    ).scalar_one_or_none()
    if not creds:
        return None, None

    built = draft_content_from_application(
        app.title,
        app.company,
        app.job_url,
        app.package_draft,
    )
    if not built:
        return None, None

    subject, body_text = built
    try:
        draft_resp = await create_draft_plain(
            settings,
            creds.refresh_token,
            subject=subject,
            body=body_text,
            to=None,
        )
    except Exception:
        logger.exception("apply_agent: Gmail draft creation failed after approval")
        return None, GMAIL_DRAFT_FAILED_USER_MESSAGE

    did = draft_resp.get("id")
    draft_id = did if isinstance(did, str) else ""
    return (
        {
            "draft_id": draft_id,
            "gmail_web_url": "https://mail.google.com/mail/u/0/#drafts",
        },
        None,
    )
