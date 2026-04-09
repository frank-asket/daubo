from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps.users import get_clerk_user_id
from app.models import JobApplication, UserResume
from app.schemas.me import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    ResumeIn,
    ResumeOut,
)

router = APIRouter(tags=["me"])


@router.get("/me/stats")
async def me_stats(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
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
    return row


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
