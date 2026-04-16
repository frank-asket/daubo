"""Prep autopilot: auto-generate application packages (+ optional Gmail drafts). Does not submit on LinkedIn or employer sites."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..models import AutopilotRunItem, JobApplication, UserGmailCredentials, UserResume
from .application_package import generate_application_package
from .gmail_integration import (
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


def _retry_application_ids_for_scope(
    item_rows: list[AutopilotRunItem],
    retry_scope: str | None,
) -> set[UUID]:
    ids: set[UUID] = set()
    if retry_scope not in {"failed_only", "gmail_failed_only"}:
        return ids
    for it in item_rows:
        if it.application_id is None:
            continue
        if retry_scope == "failed_only" and it.status == "failed":
            ids.add(it.application_id)
        if retry_scope == "gmail_failed_only" and it.status == "prepared_draft_failed":
            ids.add(it.application_id)
    return ids


async def run_autopilot_pass(
    session: AsyncSession,
    user_id: str,
    app_settings: Settings,
    *,
    limit: int = 6,
    create_gmail_drafts: bool = False,
    run_id: UUID | None = None,
    retry_scope: str | None = None,
    source_run_id: UUID | None = None,
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
    all_rows = list(q.scalars().all())

    retry_ids: set[UUID] | None = None
    if retry_scope in {"failed_only", "gmail_failed_only"}:
        item_q = select(AutopilotRunItem).where(AutopilotRunItem.clerk_user_id == user_id)
        if source_run_id is not None:
            item_q = item_q.where(AutopilotRunItem.run_id == source_run_id)
        item_q = item_q.order_by(AutopilotRunItem.updated_at.desc())
        item_rows = (await session.execute(item_q)).scalars().all()
        retry_ids = _retry_application_ids_for_scope(list(item_rows), retry_scope)

    if retry_scope == "gmail_failed_only":
        candidates = [r for r in all_rows if retry_ids and r.id in retry_ids][: max(1, min(limit, 25))]
    elif retry_scope == "failed_only":
        candidates = [r for r in all_rows if retry_ids and r.id in retry_ids and _needs_package(r)][
            : max(1, min(limit, 25))
        ]
    else:
        candidates = [r for r in all_rows if _needs_package(r)][: max(1, min(limit, 25))]

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
        item = AutopilotRunItem(
            run_id=run_id,
            clerk_user_id=user_id,
            application_id=row.id,
            title=row.title,
            company=row.company,
            job_url=row.job_url,
            status="running",
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
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
            item.status = "prepared"
            item.error = None
            session.add(item)
            await session.commit()
            await session.refresh(row)
            processed += 1
        except Exception as exc:  # noqa: BLE001
            await session.rollback()
            logger.exception("autopilot package failed")
            errors.append(f"{row.title} · {row.company}: {exc!s}"[:240])
            item.status = "failed"
            item.error = str(exc)[:500]
            session.add(item)
            await session.commit()
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
                    item.status = "prepared_with_draft"
                    item.error = None
                    session.add(item)
                    await session.commit()
                    gmail_created += 1
                except Exception as exc:  # noqa: BLE001
                    logger.exception("autopilot gmail draft failed")
                    errors.append(f"Gmail draft · {row.title}: {exc!s}"[:200])
                    item.status = "prepared_draft_failed"
                    item.error = str(exc)[:500]
                    session.add(item)
                    await session.commit()

        await asyncio.sleep(1.0)

    return {
        "processed": processed,
        "gmail_drafts_created": gmail_created,
        "errors": errors,
    }
