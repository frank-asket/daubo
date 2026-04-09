"""Background: infer market params from saved resume and run job discovery without user clicks."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import func, select

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.models import AgentMatchRun, JobApplication, UserResume
from app.schemas.jobs import JobDiscoverParams, JobDiscoverResponse, ResumeSearchInference
from app.services.job_discovery import run_job_discovery
from app.services.llm import chat_llm

logger = logging.getLogger("daubo")

KIND = "resume_autodiscover"
COOLDOWN = timedelta(minutes=12)
RESUME_EXCERPT = 12_000

INFER_SYSTEM = """You read a CV/resume and output structured job-search hints.
Rules:
- country: English name of the primary country where this person is located or most likely authorized to work (infer from address, phone, institutions, or experience). If truly unknown, answer "United States".
- country_code: ISO 3166-1 alpha-2 only if you are fairly sure (e.g. US, FR). Otherwise null.
- city_or_region: city or region if clear from the document; else null.
- industries: up to 8 short sector tags implied by roles (e.g. healthcare, logistics).
- role_focus: one short phrase for the main role to hunt (e.g. "ICU nurse", "warehouse supervisor").
- languages: spoken languages listed or clearly implied; else empty.
Output the schema only; no prose."""


def schedule_resume_auto_match(clerk_user_id: str) -> None:
    """Fire-and-forget after resume save (same event loop as the request)."""
    try:
        asyncio.create_task(run_resume_auto_match_for_user(clerk_user_id))
    except RuntimeError:
        logger.warning("Could not schedule resume auto-match (no running event loop)")


async def _infer_params(settings: Settings, resume_text: str) -> JobDiscoverParams:
    excerpt = resume_text.strip()[:RESUME_EXCERPT]
    llm = chat_llm(settings).with_structured_output(ResumeSearchInference)
    messages = [
        SystemMessage(content=INFER_SYSTEM),
        HumanMessage(content=excerpt),
    ]
    try:
        inf = await llm.ainvoke(messages)
    except Exception:
        logger.exception("resume search inference failed; using broad defaults")
        inf = ResumeSearchInference(
            country="United States",
            country_code=None,
            city_or_region=None,
            industries=[],
            role_focus=None,
            languages=[],
        )
    return JobDiscoverParams(
        country=inf.country.strip()[:120] or "United States",
        country_code=(inf.country_code.strip().upper()[:2] if inf.country_code else None),
        city_or_region=(inf.city_or_region.strip()[:200] if inf.city_or_region else None),
        industries=[s.strip() for s in inf.industries if s.strip()][:20],
        role_focus=(inf.role_focus.strip()[:500] if inf.role_focus else None),
        languages=[s.strip() for s in inf.languages if s.strip()][:20],
        locale="en",
        pasted_listings=None,
        resume_context=excerpt,
    )


async def _persist_applications_from_parsed(
    session,
    clerk_user_id: str,
    parsed: list,
) -> None:
    for pl in parsed:
        title = (pl.title or "").strip()
        if not title:
            continue
        company = ((pl.employer or "").strip() or "Role to explore")[:500]
        exists = await session.scalar(
            select(func.count())
            .select_from(JobApplication)
            .where(
                JobApplication.clerk_user_id == clerk_user_id,
                JobApplication.title == title[:500],
                JobApplication.company == company,
            )
        )
        if exists and exists > 0:
            continue
        notes_parts = []
        if pl.location:
            notes_parts.append(pl.location)
        if pl.excerpt:
            notes_parts.append(pl.excerpt)
        notes = "\n".join(notes_parts) if notes_parts else None
        session.add(
            JobApplication(
                clerk_user_id=clerk_user_id,
                title=title[:500],
                company=company,
                location=(pl.location.strip()[:300] if pl.location else None),
                status="draft",
                notes=notes[:50_000] if notes else None,
                job_url=None,
            )
        )


async def run_resume_auto_match_for_user(clerk_user_id: str) -> None:
    settings = get_settings()
    if not settings.openrouter_api_key:
        logger.info("Skipping resume auto-match: OPENROUTER_API_KEY not set")
        return

    async with SessionLocal() as session:
        last = await session.scalar(
            select(AgentMatchRun.created_at)
            .where(
                AgentMatchRun.clerk_user_id == clerk_user_id,
                AgentMatchRun.kind == KIND,
            )
            .order_by(AgentMatchRun.created_at.desc())
            .limit(1)
        )
        if last is not None:
            ts = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - ts < COOLDOWN:
                logger.info("Skipping resume auto-match: cooldown for user=%s", clerk_user_id[:12])
                return

        row = await session.scalar(
            select(UserResume).where(UserResume.clerk_user_id == clerk_user_id)
        )
        if row is None or not (row.content_text or "").strip():
            return

        resume_text = row.content_text

    params = await _infer_params(settings, resume_text)

    try:
        result = await run_job_discovery(settings, params)
    except Exception:
        logger.exception("resume auto-match discovery failed for user=%s", clerk_user_id[:12])
        return

    response = JobDiscoverResponse(
        country=params.country,
        country_code=params.country_code,
        result=result,
    )
    payload = response.model_dump(mode="json")

    async with SessionLocal() as session:
        session.add(
            AgentMatchRun(
                clerk_user_id=clerk_user_id,
                kind=KIND,
                payload=payload,
            )
        )
        await _persist_applications_from_parsed(session, clerk_user_id, result.parsed_listings)
        await session.commit()

    logger.info("Resume auto-match completed for user=%s", clerk_user_id[:12])
