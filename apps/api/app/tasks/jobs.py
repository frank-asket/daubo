import asyncio
import logging

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.tasks.celery_app import celery_app
from backend.app.models import UserPreferences, UserResume
from backend.app.schemas.jobs import JobDiscoverParams
from backend.app.services.job_discover_live import run_job_discovery_with_optional_adzuna

logger = logging.getLogger("daubo.tasks")


def _build_discovery_params(
    pref: UserPreferences | None,
    resume_text: str | None,
) -> JobDiscoverParams:
    role_focus = (pref.target_role if pref else None) or "Software Engineer"
    city_or_region = pref.location_preference if pref else None
    seniority = pref.seniority if pref else None
    return JobDiscoverParams(
        country="France",
        country_code="FR",
        city_or_region=city_or_region,
        role_focus=role_focus,
        seniority=seniority,
        industries=[],
        resume_context=(resume_text or "")[:16_000] or None,
        pasted_listings=None,
    )


async def _run_discovery_for_all_users() -> dict:
    settings = get_settings()
    queued = 0
    failed = 0

    async with SessionLocal() as session:
        user_ids_res = await session.execute(select(UserResume.clerk_user_id))
        user_ids = sorted({uid for uid in user_ids_res.scalars().all() if uid})
        for user_id in user_ids:
            resume_res = await session.execute(
                select(UserResume).where(UserResume.clerk_user_id == user_id)
            )
            resume = resume_res.scalar_one_or_none()
            if resume is None or not (resume.content_text or "").strip():
                continue
            pref_res = await session.execute(
                select(UserPreferences).where(UserPreferences.clerk_user_id == user_id)
            )
            pref = pref_res.scalar_one_or_none()
            params = _build_discovery_params(pref, resume.content_text)
            try:
                await run_job_discovery_with_optional_adzuna(settings, params)
                queued += 1
            except Exception:  # noqa: BLE001
                failed += 1
                logger.exception("Scheduled discovery failed for user=%s", user_id[:12])
    return {"queued": queued, "failed": failed, "status": "ok"}


@celery_app.task(name="daubo.tasks.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="daubo.tasks.discovery_run_all_users")
def discovery_run_all_users() -> dict:
    """Cron entrypoint: run discovery pass for users with uploaded resumes."""
    return asyncio.run(_run_discovery_for_all_users())
