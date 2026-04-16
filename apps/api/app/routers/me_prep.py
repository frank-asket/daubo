import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.schemas.me_prep import PrepGenerateIn, PrepGenerateOut, PrepSessionOut
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import JobApplication, UserResume
from backend.app.schemas.me import ApplicationOut
from backend.app.services.application_package import (
    generate_interview_prep,
    package_summary_text,
)
from backend.app.services.prep_session_service import fetch_prep_for_application, record_prep_generation
from backend.app.services.profile_documents_context import profile_documents_prompt_block

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")


@router.get("/me/prep", response_model=PrepSessionOut)
async def get_prep_session(
    application_id: UUID = Query(..., description="Job application to load prep for."),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> PrepSessionOut:
    _app, latest, payload, as_of = await fetch_prep_for_application(
        session,
        clerk_user_id=user_id,
        application_id=application_id,
    )
    if _app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="No interview prep for this application yet. Run generate first.",
        )
    return PrepSessionOut(
        id=latest.id if latest else None,
        application_id=application_id,
        payload=payload,
        created_at=as_of,
    )


@router.post("/me/prep/generate", response_model=PrepGenerateOut)
async def generate_prep_session(
    body: PrepGenerateIn,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PrepGenerateOut:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")

    resume_row = (
        await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    ).scalar_one_or_none()
    if not resume_row or not (resume_row.content_text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Upload or save a resume first so interview prep can use your profile.",
        )

    row = (
        await session.execute(
            select(JobApplication).where(
                JobApplication.id == body.application_id,
                JobApplication.clerk_user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    supplementary = await profile_documents_prompt_block(session, user_id)
    try:
        prep = await generate_interview_prep(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            job_description=row.job_description,
            package_summary=package_summary_text(row.package_draft),
            supplementary_profile=supplementary or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("generate_prep_session failed")
        raise HTTPException(status_code=502, detail="Could not generate interview prep") from exc

    rec = await record_prep_generation(
        session,
        clerk_user_id=user_id,
        application=row,
        prep_payload=prep,
    )
    await session.commit()
    await session.refresh(row)
    return PrepGenerateOut(
        application=ApplicationOut.model_validate(row),
        prep_session_id=rec.id,
    )
