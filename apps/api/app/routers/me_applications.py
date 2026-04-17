import csv
import json
import logging
import asyncio
from io import StringIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.services.application_package import (
    generate_application_package,
    generate_interview_prep,
    package_summary_text,
)
from app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    gmail_oauth_configured,
)
from app.services.pipeline_integrity import run_pipeline_integrity_pass
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import JobApplication, UserGmailCredentials, UserResume
from backend.app.schemas.me import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationPackageRequest,
    ApplicationsIntegrityIn,
    ApplicationsIntegrityOut,
    ApplicationUpdate,
    GmailDraftOut,
)
from backend.app.services.job_approval_sync import ensure_pending_approval_for_application
from backend.app.services.prep_session_service import record_prep_generation
from backend.app.services.profile_documents_context import profile_documents_prompt_block

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")


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


@router.get("/me/applications/export")
async def export_applications_csv(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> Response:
    result = await session.execute(
        select(JobApplication)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.desc())
    )
    rows = list(result.scalars().all())
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "title", "company", "location", "status", "job_url", "notes", "apply_channel", "updated_at"])
    for r in rows:
        notes = (r.notes or "").replace("\r", " ").replace("\n", " ").strip()[:2000]
        w.writerow(
            [
                str(r.id),
                r.title,
                r.company,
                r.location or "",
                r.status,
                r.job_url or "",
                notes,
                r.apply_channel or "",
                r.updated_at.isoformat() if r.updated_at else "",
            ]
        )
    body = "\ufeff" + buf.getvalue()
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="daubo-my-jobs.csv"'},
    )


@router.post("/me/applications", response_model=ApplicationOut)
async def create_application(
    body: ApplicationCreate,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JobApplication:
    cap = settings.daubo_max_job_applications_per_user
    if cap > 0:
        current = await session.scalar(
            select(func.count()).select_from(JobApplication).where(JobApplication.clerk_user_id == user_id)
        )
        if int(current or 0) >= cap:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"You’ve saved the maximum number of jobs for your current plan ({cap}). "
                    "Remove a job from My jobs to add another, or contact support about upgrading."
                ),
            )
    row = JobApplication(
        clerk_user_id=user_id,
        title=body.title,
        company=body.company,
        location=body.location,
        status=body.status,
        notes=body.notes,
        job_url=body.job_url,
        apply_channel=body.apply_channel,
        job_description=body.job_description,
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
    for k, v in body.model_dump(exclude_unset=True).items():
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


@router.post("/me/applications/integrity-check", response_model=ApplicationsIntegrityOut)
async def run_applications_integrity_check(
    body: ApplicationsIntegrityIn | None = None,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> ApplicationsIntegrityOut:
    req = body or ApplicationsIntegrityIn()
    out = await run_pipeline_integrity_pass(
        session,
        user_id,
        dry_run=req.dry_run,
        stale_days=req.stale_days,
    )
    return ApplicationsIntegrityOut.model_validate(out)


@router.get("/me/applications/stream")
async def applications_stream(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
):
    async def _snapshot() -> dict[str, object]:
        total = int(
            await session.scalar(
                select(func.count()).select_from(JobApplication).where(JobApplication.clerk_user_id == user_id)
            )
            or 0
        )
        max_updated = await session.scalar(
            select(func.max(JobApplication.updated_at)).where(JobApplication.clerk_user_id == user_id)
        )
        status_rows = await session.execute(
            select(JobApplication.status, func.count())
            .where(JobApplication.clerk_user_id == user_id)
            .group_by(JobApplication.status)
        )
        by_status = {str(status): int(count) for status, count in status_rows.all()}
        return {
            "total": total,
            "max_updated_at": max_updated.isoformat() if max_updated else None,
            "by_status": by_status,
        }

    async def event_gen():
        last_sig: str | None = None
        while True:
            payload = await _snapshot()
            sig = json.dumps(payload, sort_keys=True)
            if sig != last_sig:
                yield f"event: pipeline_update\ndata: {sig}\n\n"
                last_sig = sig
            else:
                # Keep SSE connections alive when nothing changes.
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


@router.post("/me/applications/{application_id}/application-package", response_model=ApplicationOut)
async def build_application_package(
    application_id: UUID,
    body: ApplicationPackageRequest | None = None,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JobApplication:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")

    resume_row = (
        await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    ).scalar_one_or_none()
    if not resume_row or not (resume_row.content_text or "").strip():
        raise HTTPException(status_code=400, detail="Upload or save a resume first so Daubo can tailor your application package.")

    row = (
        await session.execute(
            select(JobApplication).where(
                JobApplication.id == application_id,
                JobApplication.clerk_user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    req = body or ApplicationPackageRequest()
    if req.job_description is not None:
        row.job_description = req.job_description
    if req.apply_channel is not None:
        row.apply_channel = req.apply_channel
    supplementary = await profile_documents_prompt_block(session, user_id)
    try:
        package = await generate_application_package(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            location=row.location,
            job_description=row.job_description,
            apply_channel=row.apply_channel,
            supplementary_profile=supplementary or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("build_application_package failed")
        raise HTTPException(status_code=502, detail="Could not generate application package") from exc

    row.package_draft = package
    if row.status not in {"applied", "interview", "offer", "closed"}:
        row.status = "package_ready"
    await session.commit()
    await session.refresh(row)
    await ensure_pending_approval_for_application(session, row)
    return row


@router.post("/me/applications/{application_id}/interview-prep", response_model=ApplicationOut)
async def build_interview_prep(
    application_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JobApplication:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")
    resume_row = (
        await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    ).scalar_one_or_none()
    if not resume_row or not (resume_row.content_text or "").strip():
        raise HTTPException(status_code=400, detail="Upload or save a resume first so interview prep can use your profile.")
    row = (
        await session.execute(
            select(JobApplication).where(
                JobApplication.id == application_id,
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
        logger.exception("build_interview_prep failed")
        raise HTTPException(status_code=502, detail="Could not generate interview prep") from exc
    await record_prep_generation(
        session,
        clerk_user_id=user_id,
        application=row,
        prep_payload=prep,
    )
    await session.commit()
    await session.refresh(row)
    return row


@router.post("/me/applications/{application_id}/gmail-draft", response_model=GmailDraftOut)
async def create_gmail_draft_for_application(
    application_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GmailDraftOut:
    if not gmail_oauth_configured(settings):
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on the API.")
    creds = (
        await session.execute(select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id))
    ).scalar_one_or_none()
    if not creds:
        raise HTTPException(status_code=400, detail="Connect Gmail under Settings before creating a draft.")
    app_row = (
        await session.execute(
            select(JobApplication).where(
                JobApplication.id == application_id,
                JobApplication.clerk_user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    pkg = app_row.package_draft if isinstance(app_row.package_draft, dict) else {}
    built = draft_content_from_application(app_row.title, app_row.company, app_row.job_url, pkg)
    if not built:
        raise HTTPException(status_code=400, detail="Generate an application package with email/cover text first.")
    subject, body_text = built

    try:
        draft_resp = await create_draft_plain(
            settings,
            creds.refresh_token,
            subject=subject,
            body=body_text,
            to=None,
        )
    except Exception as exc:
        logger.exception("gmail draft creation failed")
        raise HTTPException(
            status_code=502,
            detail="Gmail refused the draft. Reconnect Gmail under Settings or try again.",
        ) from exc

    draft_id = draft_resp.get("id")
    return GmailDraftOut(
        draft_id=draft_id if isinstance(draft_id, str) else "",
        gmail_web_url="https://mail.google.com/mail/u/0/#drafts",
    )

