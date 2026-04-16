"""Dashboard agent snapshot and aggregate stats (shared by backend and apps/api)."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings, get_settings
from ..db import get_db
from ..deps.users import get_clerk_user_id
from ..models import AgentMatchRun, AutopilotRun, JobApplication, UserGmailCredentials, UserResume
from ..schemas.me import (
    AgentStatusItemOut,
    AgentStatusOut,
    MeStatsAgentsOut,
    MeStatsCareerOut,
    MeStatsLimitsOut,
    MeStatsOnboardingOut,
    MeStatsOut,
)

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")

_AUTODISCOVER_KIND = "resume_autodiscover"


async def _build_agent_status(
    *,
    user_id: str,
    session: AsyncSession,
    settings: Settings,
) -> AgentStatusOut:
    """
    Lightweight, dashboard-friendly snapshot of "agent status".

    This is not a scheduler/worker heartbeat. It summarizes capability configuration plus the most
    recent user-scoped timestamps we can infer from persisted runs and artifacts.
    """
    openrouter = bool((settings.openrouter_api_key or "").strip())

    latest_match_ts = None
    latest_pkg_ts = None
    latest_prep_ts = None
    latest_autopilot_ts = None
    autopilot_running = False

    try:
        match_res = await session.execute(
            select(AgentMatchRun.created_at)
            .where(
                AgentMatchRun.clerk_user_id == user_id,
                AgentMatchRun.kind == _AUTODISCOVER_KIND,
            )
            .order_by(AgentMatchRun.created_at.desc())
            .limit(1)
        )
        latest_match_ts = match_res.scalar_one_or_none()

        pkg_res = await session.execute(
            select(func.max(JobApplication.updated_at))
            .where(
                JobApplication.clerk_user_id == user_id,
                JobApplication.package_draft.is_not(None),
            )
        )
        latest_pkg_ts = pkg_res.scalar_one_or_none()

        prep_res = await session.execute(
            select(func.max(JobApplication.updated_at))
            .where(
                JobApplication.clerk_user_id == user_id,
                JobApplication.interview_prep.is_not(None),
            )
        )
        latest_prep_ts = prep_res.scalar_one_or_none()

        ap_latest = await session.execute(
            select(AutopilotRun.started_at, AutopilotRun.status)
            .where(AutopilotRun.clerk_user_id == user_id)
            .order_by(AutopilotRun.started_at.desc())
            .limit(1)
        )
        row = ap_latest.first()
        if row is not None:
            latest_autopilot_ts = row[0]
            autopilot_running = (row[1] or "").lower() == "running"
    except SQLAlchemyError:
        logger.exception("agent_status database error")
        raise HTTPException(
            status_code=503,
            detail="Daubo is temporarily unavailable. Please try again in a moment.",
        ) from None

    has_resume = bool(
        await session.scalar(
            select(func.count())
            .select_from(UserResume)
            .where(UserResume.clerk_user_id == user_id)
        )
    )

    agents: list[AgentStatusItemOut] = [
        AgentStatusItemOut(
            agent_id="discovery_agent",
            name="Discovery agent",
            description="Scans role opportunities based on your profile and preferences",
            state="active",
            last_run_at=latest_match_ts,
        ),
        AgentStatusItemOut(
            agent_id="match_scorer",
            name="Match scorer",
            description="Runs fit scoring (1-5) against your resume profile",
            state="idle" if not has_resume else "active",
            last_run_at=latest_match_ts,
        ),
        AgentStatusItemOut(
            agent_id="resume_tailor",
            name="Resume tailor",
            description="Generates ATS-optimized resume variants per job description",
            state="active" if (openrouter and has_resume) else "idle",
            last_run_at=latest_pkg_ts,
        ),
        AgentStatusItemOut(
            agent_id="cover_letter_writer",
            name="Cover letter writer",
            description="Drafts personalized cover letters and LinkedIn notes",
            state="active" if (openrouter and has_resume) else "idle",
            last_run_at=latest_pkg_ts,
        ),
        AgentStatusItemOut(
            agent_id="apply_agent",
            name="Apply agent",
            description="Executes channel-aware apply handoff after approval",
            state="working" if autopilot_running else "idle",
            last_run_at=latest_autopilot_ts,
        ),
        AgentStatusItemOut(
            agent_id="prep_agent",
            name="Prep agent",
            description="Generates STAR-R interview questions and company briefs",
            state="active" if (openrouter and has_resume) else "idle",
            last_run_at=latest_prep_ts,
        ),
    ]

    last_orch = None
    for ts in (latest_match_ts, latest_pkg_ts, latest_prep_ts, latest_autopilot_ts):
        if ts is None:
            continue
        if last_orch is None or ts > last_orch:
            last_orch = ts

    return AgentStatusOut(last_orchestration_at=last_orch, agents=agents)


@router.get("/me/agents/status", response_model=AgentStatusOut)
async def agent_status(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AgentStatusOut:
    return await _build_agent_status(user_id=user_id, session=session, settings=settings)


@router.get("/agents/status")
async def agents_status_stream(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    async def event_gen():
        while True:
            payload = await _build_agent_status(user_id=user_id, session=session, settings=settings)
            data = json.dumps(payload.model_dump(mode="json"))
            yield f"event: agent_status\ndata: {data}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/me/stats", response_model=MeStatsOut)
async def me_stats(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MeStatsOut:
    try:
        app_count = await session.scalar(
            select(func.count())
            .select_from(JobApplication)
            .where(JobApplication.clerk_user_id == user_id)
        )
        resume_count = await session.scalar(
            select(func.count())
            .select_from(UserResume)
            .where(UserResume.clerk_user_id == user_id)
        )
        status_rows = await session.execute(
            select(JobApplication.status, func.count())
            .where(JobApplication.clerk_user_id == user_id)
            .group_by(JobApplication.status)
        )
        by_status = {row[0]: int(row[1]) for row in status_rows.all()}
        ready = by_status.get("ready_to_apply", 0) + by_status.get("ready", 0)
        package_ready = by_status.get("package_ready", 0)
        exploring = (
            by_status.get("draft", 0)
            + by_status.get("shortlisted", 0)
        )
        in_play = by_status.get("applied", 0) + by_status.get("interview", 0)
        gmail_count = await session.scalar(
            select(func.count())
            .select_from(UserGmailCredentials)
            .where(UserGmailCredentials.clerk_user_id == user_id)
        )
    except SQLAlchemyError:
        logger.exception("me_stats database error (tables missing, connection, or SSL?)")
        raise HTTPException(
            status_code=503,
            detail="Daubo is temporarily unavailable. Please try again in a moment.",
        ) from None
    except Exception:
        logger.exception("me_stats unexpected error (returning 503 to avoid opaque 500)")
        raise HTTPException(
            status_code=503,
            detail="Could not load your dashboard. Please try again.",
        ) from None
    n_apps = int(app_count or 0)
    has_resume = bool(resume_count)
    gmail_connected = bool(gmail_count)
    cap = settings.daubo_max_job_applications_per_user
    openrouter = bool((settings.openrouter_api_key or "").strip())
    tavily = bool((settings.tavily_api_key or "").strip())
    return MeStatsOut(
        application_count=n_apps,
        has_resume=has_resume,
        career=MeStatsCareerOut(
            ready_to_submit=ready,
            package_ready=package_ready,
            exploring=exploring,
            applied_or_interview=in_play,
        ),
        onboarding=MeStatsOnboardingOut(
            resume_added=has_resume,
            job_saved=n_apps > 0,
            gmail_connected=gmail_connected,
            setup_complete=has_resume and n_apps > 0,
        ),
        limits=MeStatsLimitsOut(
            max_tracked_jobs=cap if cap > 0 else None,
            tracked_jobs=n_apps,
        ),
        agents=MeStatsAgentsOut(
            openrouter_configured=openrouter,
            tavily_configured=tavily,
            job_web_search_copilot=openrouter and tavily,
        ),
    )
