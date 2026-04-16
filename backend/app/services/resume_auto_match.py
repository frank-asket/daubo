"""Background: infer market params from saved resume and run job discovery without user clicks."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import func, select

from ..config import Settings, get_settings
from ..db import SessionLocal
from ..models import AgentMatchRun, JobApplication, UserResume
from ..schemas.jobs import (
    JobDiscoverLLMOut,
    JobDiscoverParams,
    JobDiscoverResponse,
    PortalGuide,
    ResumeSearchInference,
)
from .adzuna_jobs import (
    build_adzuna_search_query,
    fetch_adzuna_listings,
    resolve_adzuna_country_slug,
)
from .job_discover_live import run_job_discovery_with_optional_adzuna
from .llm import chat_llm

logger = logging.getLogger("daubo")

KIND = "resume_autodiscover"
COOLDOWN = timedelta(minutes=12)
RESUME_EXCERPT = 12_000

INFER_SYSTEM = """You read a CV/resume and output structured job-search hints for Daubo job discovery.
Rules:
- country / country_code / city_or_region: Primary base — where the person most likely lives, works, or is authorized to work today (address, phone, recent roles, institutions). If truly unknown, use "United States" / US.
- additional_country_codes: Up to 6 OTHER ISO 3166-1 alpha-2 codes only when the CV shows clear ties: past jobs abroad, dual markets, education, citizenship, "open to roles in X/Y", relocation targets, or clients across borders. Never duplicate country_code. Use [] if none.
- open_to_remote_or_global: True if the CV mentions remote work, hybrid, distributed teams, digital nomad, worldwide applicants, EU+US search, "anywhere", or similar; false otherwise.
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
            additional_country_codes=[],
            open_to_remote_or_global=False,
            industries=[],
            role_focus=None,
            languages=[],
        )
    return JobDiscoverParams(
        country=inf.country.strip()[:120] or "United States",
        country_code=(inf.country_code.strip().upper()[:2] if inf.country_code else None),
        city_or_region=(inf.city_or_region.strip()[:200] if inf.city_or_region else None),
        additional_country_codes=list(inf.additional_country_codes),
        emphasize_remote_global=bool(inf.open_to_remote_or_global),
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
        url = getattr(pl, "source_url", None)
        job_url = url.strip()[:2000] if isinstance(url, str) and url.strip() else None
        session.add(
            JobApplication(
                clerk_user_id=clerk_user_id,
                title=title[:500],
                company=company,
                location=(pl.location.strip()[:300] if pl.location else None),
                status="draft",
                notes=notes[:50_000] if notes else None,
                job_url=job_url,
            )
        )


async def _resume_automatch_adzuna_only(
    settings: Settings,
    clerk_user_id: str,
    resume_text: str,
) -> None:
    """Fill pipeline from Adzuna when OpenRouter is off (no LLM inference)."""
    excerpt = resume_text.strip()[:RESUME_EXCERPT]
    params = JobDiscoverParams(
        country="United States",
        country_code="US",
        city_or_region=None,
        additional_country_codes=[],
        emphasize_remote_global=False,
        industries=[],
        role_focus=None,
        languages=[],
        locale="en",
        pasted_listings=None,
        resume_context=excerpt,
    )
    slug = resolve_adzuna_country_slug(
        params.country_code,
        params.country,
        default_slug=(settings.adzuna_default_country or "").strip() or None,
    )
    if not slug:
        logger.warning("Adzuna-only auto-match: no regional slug (set ADZUNA_DEFAULT_COUNTRY)")
        return

    api_listings = await fetch_adzuna_listings(
        settings,
        country_slug=slug,
        what=build_adzuna_search_query(params),
        where=params.city_or_region,
        max_results=15,
    )

    result = JobDiscoverLLMOut(
        executive_summary=(
            "OpenRouter is not configured, so there is no AI matching plan. "
            f"The rows below are live Adzuna listings for region {slug!r} when your API keys return data."
        ),
        portals=[
            PortalGuide(
                name="Adzuna API",
                kind="aggregator",
                how_to_use="Register at https://developer.adzuna.com/ for app_id and app_key; "
                "set ADZUNA_APP_ID, ADZUNA_APP_KEY, and optionally ADZUNA_DEFAULT_COUNTRY (e.g. gb, fr).",
            )
        ],
        example_search_queries=[build_adzuna_search_query(params)],
        filters_to_apply=[],
        regulatory_reminders=(
            "Open the original posting to confirm details. Aggregated listings can be stale or redirected."
        ),
        parsed_listings=api_listings,
    )
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

    logger.info(
        "Adzuna-only resume auto-match completed user=%s listings=%s",
        clerk_user_id[:12],
        len(api_listings),
    )


async def run_resume_auto_match_for_user(clerk_user_id: str) -> None:
    settings = get_settings()
    has_or = bool((settings.openrouter_api_key or "").strip())
    has_adz = bool((settings.adzuna_app_id or "").strip() and (settings.adzuna_app_key or "").strip())

    if not has_or and not has_adz:
        logger.info(
            "Skipping resume auto-match: set OPENROUTER_API_KEY and/or ADZUNA_APP_ID + ADZUNA_APP_KEY"
        )
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

    if not has_or and has_adz:
        await _resume_automatch_adzuna_only(settings, clerk_user_id, resume_text)
        return

    params = await _infer_params(settings, resume_text)

    try:
        result = await run_job_discovery_with_optional_adzuna(settings, params)
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


async def infer_job_discover_params_from_resume_text(
    settings: Settings,
    resume_text: str,
) -> JobDiscoverParams:
    """Infer discover parameters from résumé text (same logic as background auto-match)."""
    text = (resume_text or "").strip()
    if not text:
        raise ValueError("Resume text is empty")
    if not (settings.openrouter_api_key or "").strip():
        raise ValueError("OPENROUTER_API_KEY is required for resume-based discovery hints")
    return await _infer_params(settings, text)
