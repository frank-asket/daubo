"""Persist resume-derived skills + context; read from DB for dashboards and agents."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import UserResume
from app.services.resume_profile_signals import ResumeProfileSignals, extract_resume_profile_signals

if TYPE_CHECKING:
    from backend.app.config import Settings

logger = logging.getLogger("daubo")


def hash_resume_content(resume_text: str) -> str:
    body = (resume_text or "").encode("utf-8", errors="replace")
    return hashlib.sha256(body).hexdigest()


async def persist_resume_profile_signals(
    session: AsyncSession,
    settings: "Settings",
    clerk_user_id: str,
    resume_text: str,
) -> ResumeProfileSignals | None:
    if not (settings.openrouter_api_key or "").strip():
        return None
    body = (resume_text or "").strip()
    if not body:
        return None
    try:
        signals = await extract_resume_profile_signals(settings, body)
    except Exception:
        logger.exception("persist_resume_profile_signals extraction failed")
        return None

    h = hash_resume_content(body)
    now = datetime.now(timezone.utc)
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == clerk_user_id))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    row.profile_signals = signals.model_dump()
    row.profile_content_hash = h
    row.profile_extracted_at = now
    await session.commit()
    await session.refresh(row)
    return signals


def signals_from_row(row: UserResume | None) -> tuple[ResumeProfileSignals | None, bool]:
    if row is None or not (row.content_text or "").strip():
        return None, False
    current_hash = hash_resume_content(row.content_text)
    if not row.profile_signals or not isinstance(row.profile_signals, dict):
        return None, True
    if (row.profile_content_hash or "") != current_hash:
        return None, True
    try:
        return ResumeProfileSignals.model_validate(row.profile_signals), False
    except Exception:
        logger.exception("signals_from_row validate failed")
        return None, True


async def get_or_refresh_resume_profile_signals(
    session: AsyncSession,
    settings: "Settings",
    clerk_user_id: str,
    *,
    force_refresh: bool = False,
) -> ResumeProfileSignals:
    if not (settings.openrouter_api_key or "").strip():
        raise ValueError("OPENROUTER_API_KEY is not configured")
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == clerk_user_id))
    row = result.scalar_one_or_none()
    if row is None or not (row.content_text or "").strip():
        raise ValueError("Add your resume first — we extract skills and context from it.")

    stored, stale = signals_from_row(row)
    if stored is not None and not stale and not force_refresh:
        return stored

    signals = await extract_resume_profile_signals(settings, row.content_text)
    h = hash_resume_content(row.content_text)
    row.profile_signals = signals.model_dump()
    row.profile_content_hash = h
    row.profile_extracted_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(row)
    return signals

