import hashlib
import json
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from redis.asyncio import from_url as redis_from_url
from sqlalchemy import func, select

from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import JobListing
from backend.app.schemas.jobs import JobDiscoverParams, JobDiscoverResponse, JobListItem, JobListOut
from backend.app.services.job_discover_live import run_job_discovery_with_optional_adzuna
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id

router = APIRouter(tags=["jobs"])

_JOB_SCORE_CACHE_TTL_SECONDS = 6 * 60 * 60


def _listing_external_id(title: str, company: str, url: str | None) -> str:
    raw = f"{title.strip().lower()}|{company.strip().lower()}|{(url or '').strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _jobs_cache_key(*, user_id: str, min_fit: float, location: str | None, page: int, page_size: int) -> str:
    payload = json.dumps(
        {
            "user_id": user_id,
            "min_fit": min_fit,
            "location": (location or "").strip().lower(),
            "page": page,
            "page_size": page_size,
        },
        sort_keys=True,
    )
    return f"jobs:list:{hashlib.sha256(payload.encode('utf-8')).hexdigest()}"


async def _jobs_stream_snapshot(session: AsyncSession, user_id: str) -> dict[str, object]:
    total = int(
        await session.scalar(select(func.count()).select_from(JobListing).where(JobListing.clerk_user_id == user_id))
        or 0
    )
    max_discovered = await session.scalar(
        select(func.max(JobListing.discovered_at)).where(JobListing.clerk_user_id == user_id)
    )
    high_fit = int(
        await session.scalar(
            select(func.count())
            .select_from(JobListing)
            .where(
                JobListing.clerk_user_id == user_id,
                JobListing.fit_score.is_not(None),
                JobListing.fit_score >= 4.0,
            )
        )
        or 0
    )
    return {
        "total": total,
        "high_fit": high_fit,
        "max_discovered_at": max_discovered.isoformat() if max_discovered else None,
    }


@router.post("/jobs/discover", response_model=JobDiscoverResponse)
async def discover_jobs(
    body: JobDiscoverParams,
    settings: Settings = Depends(get_settings),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> JobDiscoverResponse:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")
    try:
        result = await run_job_discovery_with_optional_adzuna(settings, body)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    response = JobDiscoverResponse(
        country=body.country,
        country_code=body.country_code,
        result=result,
    )
    for idx, listing in enumerate(result.parsed_listings):
        title = (listing.title or "").strip()
        company = (listing.employer or "Unknown employer").strip()
        if not title:
            continue
        ext_id = _listing_external_id(title, company, listing.source_url)
        row_res = await session.execute(
            select(JobListing).where(
                JobListing.clerk_user_id == user_id,
                JobListing.source == "discover",
                JobListing.external_id == ext_id,
            )
        )
        row = row_res.scalar_one_or_none()
        if row is None:
            row = JobListing(
                clerk_user_id=user_id,
                source="discover",
                external_id=ext_id,
                title=title,
                company=company,
            )
        row.location = (listing.location or "").strip() or None
        row.description = (listing.excerpt or "").strip() or None
        row.url = (listing.source_url or "").strip() or None
        row.fit_score = float(listing.fit_score) if listing.fit_score is not None else None
        row.fit_reasons = list(listing.fit_reasons or [])
        row.risk_flags = list(listing.risk_flags or [])
        row.page_hint = (idx // 20) + 1
        row.discovered_at = datetime.now(timezone.utc)
        session.add(row)
    await session.commit()
    return response


@router.get("/jobs", response_model=JobListOut)
async def list_jobs(
    min_fit: float = Query(default=0.0, ge=0.0, le=5.0),
    location: str | None = Query(default=None, max_length=300),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JobListOut:
    cache_key = _jobs_cache_key(
        user_id=user_id,
        min_fit=min_fit,
        location=location,
        page=page,
        page_size=page_size,
    )
    redis = redis_from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    try:
        cached = await redis.get(cache_key)
        if cached:
            payload = json.loads(cached)
            return JobListOut.model_validate(payload)
    except Exception:
        pass

    base = select(JobListing).where(JobListing.clerk_user_id == user_id)
    if min_fit > 0:
        base = base.where(JobListing.fit_score.is_not(None), JobListing.fit_score >= min_fit)
    if (location or "").strip():
        q = f"%{location.strip().lower()}%"
        base = base.where(func.lower(func.coalesce(JobListing.location, "")).like(q))

    total_res = await session.execute(select(func.count()).select_from(base.subquery()))
    total = int(total_res.scalar() or 0)
    rows_res = await session.execute(
        base.order_by(JobListing.discovered_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list(rows_res.scalars().all())
    out = JobListOut(
        items=[
            JobListItem(
                id=str(r.id),
                source=r.source,
                external_id=r.external_id,
                title=r.title,
                company=r.company,
                location=r.location,
                url=r.url,
                fit_score=r.fit_score,
                fit_reasons=r.fit_reasons if isinstance(r.fit_reasons, list) else [],
                risk_flags=r.risk_flags if isinstance(r.risk_flags, list) else [],
                discovered_at=(
                    r.discovered_at
                    if r.discovered_at.tzinfo
                    else r.discovered_at.replace(tzinfo=timezone.utc)
                ).isoformat(),
            )
            for r in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
    )
    try:
        await redis.set(cache_key, out.model_dump_json(), ex=_JOB_SCORE_CACHE_TTL_SECONDS)
    except Exception:
        pass
    finally:
        await redis.aclose()
    return out


@router.get("/jobs/stream")
async def jobs_stream(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
):
    async def event_gen():
        last_sig: str | None = None
        while True:
            payload = await _jobs_stream_snapshot(session, user_id)
            sig = json.dumps(payload, sort_keys=True)
            if sig != last_sig:
                yield f"event: discovery_update\ndata: {sig}\n\n"
                last_sig = sig
            else:
                yield "event: ping\ndata: {}\n\n"
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

