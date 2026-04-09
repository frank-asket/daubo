from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas.jobs import JobDiscoverParams, JobDiscoverResponse
from app.services.job_discovery import run_job_discovery

router = APIRouter(tags=["jobs"])


@router.post("/jobs/discover", response_model=JobDiscoverResponse)
async def discover_jobs(
    body: JobDiscoverParams,
    settings: Settings = Depends(get_settings),
) -> JobDiscoverResponse:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")
    try:
        result = await run_job_discovery(settings, body)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return JobDiscoverResponse(
        country=body.country,
        country_code=body.country_code,
        result=result,
    )
