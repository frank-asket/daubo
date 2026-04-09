import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_db
from app.deps.users import get_clerk_user_id
from app.models import AgentMatchRun, JobApplication, UserResume
from app.schemas.me import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    ResumeIn,
    ResumeOut,
    ResumeUploadOut,
)
from app.services.resume_auto_match import schedule_resume_auto_match
from app.services.resume_ingest import extract_resume_text
from app.services.resume_kickoff import agent_ack_after_resume_upload

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")

_AUTODISCOVER_KIND = "resume_autodiscover"


class AgentMatchLatestResponse(BaseModel):
    run: dict | None = None
    created_at: str | None = None


@router.get("/me/stats")
async def me_stats(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
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
    except SQLAlchemyError:
        logger.exception("me_stats database error (tables missing, connection, or SSL?)")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable or not initialized. Check Railway API logs for "
            '"Database initialized" vs "Database initialization failed", DATABASE_URL, '
            "and pgvector.",
        ) from None
    except Exception:
        logger.exception("me_stats unexpected error (returning 503 to avoid opaque 500)")
        raise HTTPException(
            status_code=503,
            detail="Could not load dashboard stats. Retry in a moment or check API logs.",
        ) from None
    return {
        "application_count": int(app_count or 0),
        "has_resume": bool(resume_count),
    }


@router.get("/me/resume", response_model=ResumeOut | None)
async def get_resume(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserResume | None:
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    return result.scalar_one_or_none()


@router.put("/me/resume", response_model=ResumeOut)
async def upsert_resume(
    body: ResumeIn,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserResume:
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row:
        row.content_text = body.content_text
        row.file_name = body.file_name
    else:
        row = UserResume(
            clerk_user_id=user_id,
            content_text=body.content_text,
            file_name=body.file_name,
        )
        session.add(row)
    await session.commit()
    await session.refresh(row)
    schedule_resume_auto_match(user_id)
    return row


@router.get("/me/agent-match/latest", response_model=AgentMatchLatestResponse)
async def latest_agent_match(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> AgentMatchLatestResponse:
    result = await session.execute(
        select(AgentMatchRun)
        .where(
            AgentMatchRun.clerk_user_id == user_id,
            AgentMatchRun.kind == _AUTODISCOVER_KIND,
        )
        .order_by(AgentMatchRun.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return AgentMatchLatestResponse(run=None, created_at=None)
    ts = row.created_at
    iso = ts.isoformat() if ts else None
    return AgentMatchLatestResponse(run=row.payload, created_at=iso)


@router.post("/me/resume/upload", response_model=ResumeUploadOut)
async def upload_resume_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ResumeUploadOut:
    raw = await file.read()
    name = (file.filename or "resume").strip() or "resume"
    try:
        content_text = await extract_resume_text(raw, name, file.content_type, settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("resume ingest failed")
        raise HTTPException(
            status_code=502,
            detail="Could not process this file. Try another format or paste the text.",
        ) from None

    if len(content_text) > 500_000:
        content_text = content_text[:500_000]

    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row:
        row.content_text = content_text
        row.file_name = name[:512]
    else:
        row = UserResume(
            clerk_user_id=user_id,
            content_text=content_text,
            file_name=name[:512],
        )
        session.add(row)
    await session.commit()
    await session.refresh(row)

    schedule_resume_auto_match(user_id)
    agent_reply = await agent_ack_after_resume_upload(settings)
    return ResumeUploadOut(
        id=row.id,
        clerk_user_id=row.clerk_user_id,
        content_text=row.content_text,
        file_name=row.file_name,
        updated_at=row.updated_at,
        agent_reply=agent_reply,
    )


@router.get("/me/applications", response_model=list[ApplicationOut])
async def list_applications(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[JobApplication]:
    result = await session.execute(
        select(JobApplication)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("/me/applications", response_model=ApplicationOut)
async def create_application(
    body: ApplicationCreate,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> JobApplication:
    row = JobApplication(
        clerk_user_id=user_id,
        title=body.title,
        company=body.company,
        location=body.location,
        status=body.status,
        notes=body.notes,
        job_url=body.job_url,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.patch("/me/applications/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: UUID,
    body: ApplicationUpdate,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> JobApplication:
    result = await session.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.clerk_user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/me/applications/{application_id}", status_code=204)
async def delete_application(
    application_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.clerk_user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    await session.delete(row)
    await session.commit()
