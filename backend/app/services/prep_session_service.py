"""Persist interview prep runs to prep_sessions and mirror onto JobApplication.interview_prep."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import JobApplication, PrepSession


async def record_prep_generation(
    session: AsyncSession,
    *,
    clerk_user_id: str,
    application: JobApplication,
    prep_payload: dict[str, Any],
) -> PrepSession:
    application.interview_prep = prep_payload
    rec = PrepSession(
        clerk_user_id=clerk_user_id,
        job_application_id=application.id,
        payload=prep_payload,
    )
    session.add(rec)
    session.add(application)
    await session.flush()
    await session.refresh(rec)
    return rec


async def fetch_prep_for_application(
    session: AsyncSession,
    *,
    clerk_user_id: str,
    application_id: UUID,
) -> tuple[JobApplication | None, PrepSession | None, dict[str, Any] | None, datetime | None]:
    """Return (application, latest_session, payload, as_of).

    Payload prefers the latest prep_sessions row; falls back to application.interview_prep.
    """
    app = (
        await session.execute(
            select(JobApplication).where(
                JobApplication.id == application_id,
                JobApplication.clerk_user_id == clerk_user_id,
            )
        )
    ).scalar_one_or_none()
    if app is None:
        return None, None, None, None

    latest = (
        await session.execute(
            select(PrepSession)
            .where(
                PrepSession.job_application_id == application_id,
                PrepSession.clerk_user_id == clerk_user_id,
            )
            .order_by(PrepSession.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if latest is not None:
        return app, latest, latest.payload, latest.created_at
    if app.interview_prep and isinstance(app.interview_prep, dict):
        return app, None, app.interview_prep, app.updated_at
    return app, None, None, None
