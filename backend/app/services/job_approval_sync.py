"""Create and sync pending JobApproval rows when application packages are ready."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import JobApplication, JobApproval

_READY_STATUSES = frozenset({"package_ready", "ready_to_apply", "ready"})


def _package_has_usable_draft(package_draft: dict[str, Any] | None) -> bool:
    if not isinstance(package_draft, dict):
        return False
    c = package_draft.get("cover_letter")
    n = package_draft.get("linkedin_note")
    return (isinstance(c, str) and c.strip()) or (isinstance(n, str) and n.strip())


def _infer_draft(app: JobApplication) -> tuple[str, str, str]:
    pkg = app.package_draft if isinstance(app.package_draft, dict) else {}
    ch = (app.apply_channel or "email").strip().lower()
    if ch == "linkedin":
        note = pkg.get("linkedin_note")
        cover = pkg.get("cover_letter")
        t1 = note if isinstance(note, str) else ""
        t2 = cover if isinstance(cover, str) else ""
        text = (t1.strip() or t2.strip() or "(see package)")
        return "linkedin_note", "linkedin", text
    cover = pkg.get("cover_letter")
    note = pkg.get("linkedin_note")
    t1 = cover if isinstance(cover, str) else ""
    t2 = note if isinstance(note, str) else ""
    text = (t1.strip() or t2.strip() or "(see package)")
    return "cover_letter", "email", text


async def ensure_pending_approval_for_application(
    session: AsyncSession,
    app: JobApplication,
) -> JobApproval | None:
    if (app.status or "").strip() not in _READY_STATUSES:
        return None
    if not _package_has_usable_draft(app.package_draft):
        return None

    existing = (
        await session.execute(
            select(JobApproval).where(
                JobApproval.job_application_id == app.id,
                JobApproval.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    approval_type, channel, body = _infer_draft(app)
    row = JobApproval(
        clerk_user_id=app.clerk_user_id,
        job_application_id=app.id,
        approval_type=approval_type,
        channel=channel,
        draft_body=body[:500_000],
        status="pending",
    )
    session.add(row)
    try:
        await session.commit()
        await session.refresh(row)
        return row
    except IntegrityError:
        await session.rollback()
        return (
            await session.execute(
                select(JobApproval).where(
                    JobApproval.job_application_id == app.id,
                    JobApproval.status == "pending",
                )
            )
        ).scalar_one_or_none()


async def sync_pending_approvals_for_user(session: AsyncSession, user_id: str) -> None:
    result = await session.execute(
        select(JobApplication).where(
            JobApplication.clerk_user_id == user_id,
            JobApplication.status.in_(_READY_STATUSES),
        )
    )
    for app in result.scalars().all():
        if _package_has_usable_draft(app.package_draft):
            await ensure_pending_approval_for_application(session, app)
