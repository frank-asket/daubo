"""Prep autopilot: auto-generate application packages (+ optional Gmail drafts). Does not submit on LinkedIn or employer sites."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import JobApplication, UserGmailCredentials, UserResume
from app.services.application_package import generate_application_package
from app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    gmail_oauth_configured,
)

logger = logging.getLogger("daubo")

_FROZEN_STATUSES = frozenset({"applied", "interview", "offer", "closed"})


def _needs_package(row: JobApplication) -> bool:
    pkg = row.package_draft
    if isinstance(pkg, dict):
        if (pkg.get("cover_letter") or "").strip() or (pkg.get("linkedin_note") or "").strip():
            return False
    if row.status == "shortlisted":
        return True
    if row.status == "draft" and (row.job_description or "").strip():
        return True
    return False


async def run_autopilot_pass(
    session: AsyncSession,
    user_id: str,
    app_settings: Settings,
    *,
    limit: int = 6,
    create_gmail_drafts: bool = False,
) -> dict[str, Any]:
    if not app_settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    resume_r = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    resume = resume_r.scalar_one_or_none()
    if not resume or not (resume.content_text or "").strip():
        raise ValueError("Upload a resume before running the prep autopilot.")

    q = await session.execute(
        select(JobApplication)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.asc())
    )
    candidates = [r for r in q.scalars().all() if _needs_package(r)][: max(1, min(limit, 25))]

    gmail_creds: UserGmailCredentials | None = None
    if create_gmail_drafts and gmail_oauth_configured(app_settings):
        gc = await session.execute(
            select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
        )
        gmail_creds = gc.scalar_one_or_none()

    processed = 0
    gmail_created = 0
    errors: list[str] = []

    for row in candidates:
        try:
            package = await generate_application_package(
                app_settings,
                resume_text=resume.content_text,
                title=row.title,
                company=row.company,
                location=row.location,
                job_description=row.job_description,
                apply_channel=row.apply_channel,
            )
            row.package_draft = package
            if row.status not in _FROZEN_STATUSES:
                row.status = "package_ready"
            session.add(row)
            await session.commit()
            await session.refresh(row)
            processed += 1
        except Exception as exc:  # noqa: BLE001
            await session.rollback()
            logger.exception("autopilot package failed")
            errors.append(f"{row.title} · {row.company}: {exc!s}"[:240])
            await asyncio.sleep(0.5)
            continue

        if create_gmail_drafts and gmail_creds:
            payload = draft_content_from_application(
                row.title,
                row.company,
                row.job_url,
                row.package_draft,
            )
            if payload:
                subject, body_text = payload
                try:
                    await create_draft_plain(
                        app_settings,
                        gmail_creds.refresh_token,
                        subject=subject,
                        body=body_text,
                        to=None,
                    )
                    gmail_created += 1
                except Exception as exc:  # noqa: BLE001
                    logger.exception("autopilot gmail draft failed")
                    errors.append(f"Gmail draft · {row.title}: {exc!s}"[:200])

        await asyncio.sleep(1.0)

    return {
        "processed": processed,
        "gmail_drafts_created": gmail_created,
        "errors": errors,
    }
