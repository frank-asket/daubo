from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.schemas.me_approvals import (
    ApprovalApproveIn,
    ApprovalApproveOut,
    ApprovalQueueItemOut,
    LinkedInHandoffOut,
)
from app.services.me_autopilot_helpers import normalize_idempotency_key
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import JobApplication, JobApproval
from backend.app.schemas.me import ApplicationOut, GmailDraftOut
from backend.app.services.apply_agent import (
    build_linkedin_handoff_payload,
    try_create_gmail_draft_after_approval,
)
from backend.app.services.approval_idempotency import (
    approval_approve_fingerprint,
    approval_idempotency_poll_cache,
    approval_idempotency_read,
    approval_idempotency_release_lock,
    approval_idempotency_try_lock,
    approval_idempotency_write,
    approval_reject_fingerprint,
    dump_model,
    require_redis_for_idempotency,
)
from backend.app.services.job_approval_sync import sync_pending_approvals_for_user

router = APIRouter(tags=["me"])


@router.get("/me/approvals", response_model=list[ApprovalQueueItemOut])
async def list_pending_approvals(
    application_id: UUID | None = Query(
        default=None,
        description="When set, only pending approvals for this job application are returned.",
    ),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItemOut]:
    await sync_pending_approvals_for_user(session, user_id)
    stmt = (
        select(JobApproval, JobApplication)
        .join(JobApplication, JobApproval.job_application_id == JobApplication.id)
        .where(
            JobApproval.clerk_user_id == user_id,
            JobApproval.status == "pending",
        )
    )
    if application_id is not None:
        stmt = stmt.where(JobApplication.id == application_id)
    result = await session.execute(stmt.order_by(JobApproval.created_at.desc()))
    out: list[ApprovalQueueItemOut] = []
    for approval, app in result.all():
        pkg = app.package_draft if isinstance(app.package_draft, dict) else None
        out.append(
            ApprovalQueueItemOut(
                id=approval.id,
                application_id=app.id,
                title=app.title,
                company=app.company,
                location=app.location,
                apply_channel=app.apply_channel,
                notes=app.notes,
                job_url=app.job_url,
                approval_type=approval.approval_type,
                channel=approval.channel,
                draft_body=approval.draft_body,
                package_draft=pkg,
                application_status=app.status,
            )
        )
    return out


@router.post("/me/approvals/{approval_id}/approve", response_model=ApprovalApproveOut)
async def approve_approval(
    approval_id: UUID,
    body: ApprovalApproveIn | None = None,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApprovalApproveOut:
    idem_key = normalize_idempotency_key(idempotency_key_header)
    require_redis_for_idempotency(settings.redis_url, idem_key)
    req = body or ApprovalApproveIn()
    approve_fp = approval_approve_fingerprint(
        approval_id,
        cover_letter=req.cover_letter,
        linkedin_note=req.linkedin_note,
    )
    lock_token: str | None = None
    if idem_key:
        cached = await approval_idempotency_read(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="approve",
            fingerprint=approve_fp,
        )
        if cached is not None:
            return ApprovalApproveOut.model_validate(cached)
        lock_token = await approval_idempotency_try_lock(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="approve",
        )
        if lock_token is None:
            polled = await approval_idempotency_poll_cache(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="approve",
                fingerprint=approve_fp,
            )
            if polled is not None:
                return ApprovalApproveOut.model_validate(polled)
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "idempotency_in_progress",
                    "message": "Another request is processing this Idempotency-Key. Retry shortly.",
                },
            )
        cached2 = await approval_idempotency_read(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="approve",
            fingerprint=approve_fp,
        )
        if cached2 is not None:
            await approval_idempotency_release_lock(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="approve",
                token=lock_token,
            )
            return ApprovalApproveOut.model_validate(cached2)

    try:
        return await _approve_approval_core(
            approval_id,
            req,
            user_id,
            session,
            settings,
            idem_key,
            approve_fp,
        )
    finally:
        if idem_key and lock_token:
            await approval_idempotency_release_lock(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="approve",
                token=lock_token,
            )


async def _approve_approval_core(
    approval_id: UUID,
    req: ApprovalApproveIn,
    user_id: str,
    session: AsyncSession,
    settings: Settings,
    idem_key: str | None,
    approve_fp: str,
) -> ApprovalApproveOut:
    result = await session.execute(
        select(JobApproval, JobApplication)
        .join(JobApplication, JobApproval.job_application_id == JobApplication.id)
        .where(
            JobApproval.id == approval_id,
            JobApproval.clerk_user_id == user_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    approval, app = row
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail="This approval is no longer pending.")

    pkg = dict(app.package_draft) if isinstance(app.package_draft, dict) else {}
    if req.cover_letter is not None:
        pkg["cover_letter"] = req.cover_letter
    if req.linkedin_note is not None:
        pkg["linkedin_note"] = req.linkedin_note
    app.package_draft = pkg

    gmail_out: GmailDraftOut | None = None
    gmail_warning: str | None = None
    linkedin_out: LinkedInHandoffOut | None = None

    if approval.channel == "email":
        raw, gmail_warning = await try_create_gmail_draft_after_approval(
            settings,
            session,
            user_id=user_id,
            app=app,
        )
        if raw:
            gmail_out = GmailDraftOut(**raw)
    elif approval.channel == "linkedin":
        li_payload = build_linkedin_handoff_payload(
            title=app.title,
            company=app.company,
            job_url=app.job_url,
            package_draft=app.package_draft if isinstance(app.package_draft, dict) else None,
        )
        if li_payload:
            linkedin_out = LinkedInHandoffOut(**li_payload)

    approval.status = "approved"
    if app.status not in {"applied", "interview", "offer", "closed"}:
        app.status = "applied"
    session.add(approval)
    session.add(app)
    await session.commit()
    await session.refresh(approval)
    await session.refresh(app)
    out = ApprovalApproveOut(
        application=ApplicationOut.model_validate(app),
        gmail_draft=gmail_out,
        gmail_warning=gmail_warning,
        linkedin_handoff=linkedin_out,
    )
    if idem_key:
        await approval_idempotency_write(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="approve",
            fingerprint=approve_fp,
            response=dump_model(out),
        )
    return out


@router.post("/me/approvals/{approval_id}/reject", response_model=ApplicationOut)
async def reject_approval(
    approval_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobApplication:
    idem_key = normalize_idempotency_key(idempotency_key_header)
    require_redis_for_idempotency(settings.redis_url, idem_key)
    reject_fp = approval_reject_fingerprint(approval_id)
    lock_token: str | None = None
    if idem_key:
        cached = await approval_idempotency_read(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="reject",
            fingerprint=reject_fp,
        )
        if cached is not None:
            return ApplicationOut.model_validate(cached)
        lock_token = await approval_idempotency_try_lock(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="reject",
        )
        if lock_token is None:
            polled = await approval_idempotency_poll_cache(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="reject",
                fingerprint=reject_fp,
            )
            if polled is not None:
                return ApplicationOut.model_validate(polled)
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "idempotency_in_progress",
                    "message": "Another request is processing this Idempotency-Key. Retry shortly.",
                },
            )
        cached2 = await approval_idempotency_read(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="reject",
            fingerprint=reject_fp,
        )
        if cached2 is not None:
            await approval_idempotency_release_lock(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="reject",
                token=lock_token,
            )
            return ApplicationOut.model_validate(cached2)

    try:
        return await _reject_approval_core(
            approval_id,
            user_id,
            session,
            settings,
            idem_key,
            reject_fp,
        )
    finally:
        if idem_key and lock_token:
            await approval_idempotency_release_lock(
                settings.redis_url,
                user_id=user_id,
                idem_key=idem_key,
                op="reject",
                token=lock_token,
            )


async def _reject_approval_core(
    approval_id: UUID,
    user_id: str,
    session: AsyncSession,
    settings: Settings,
    idem_key: str | None,
    reject_fp: str,
) -> JobApplication:
    result = await session.execute(
        select(JobApproval, JobApplication)
        .join(JobApplication, JobApproval.job_application_id == JobApplication.id)
        .where(
            JobApproval.id == approval_id,
            JobApproval.clerk_user_id == user_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    approval, app = row
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail="This approval is no longer pending.")

    approval.status = "rejected"
    app.status = "closed"
    session.add(approval)
    session.add(app)
    await session.commit()
    await session.refresh(app)
    if idem_key:
        app_out = ApplicationOut.model_validate(app)
        await approval_idempotency_write(
            settings.redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op="reject",
            fingerprint=reject_fp,
            response=dump_model(app_out),
        )
    return app
