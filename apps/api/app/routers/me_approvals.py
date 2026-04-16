import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.schemas.me_approvals import ApprovalApproveIn, ApprovalApproveOut, ApprovalQueueItemOut
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import JobApplication, JobApproval, UserGmailCredentials
from backend.app.schemas.me import ApplicationOut, GmailDraftOut
from backend.app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    gmail_oauth_configured,
)
from backend.app.services.job_approval_sync import sync_pending_approvals_for_user

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")


@router.get("/me/approvals", response_model=list[ApprovalQueueItemOut])
async def list_pending_approvals(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItemOut]:
    await sync_pending_approvals_for_user(session, user_id)
    result = await session.execute(
        select(JobApproval, JobApplication)
        .join(JobApplication, JobApproval.job_application_id == JobApplication.id)
        .where(
            JobApproval.clerk_user_id == user_id,
            JobApproval.status == "pending",
        )
        .order_by(JobApproval.created_at.desc())
    )
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
) -> ApprovalApproveOut:
    req = body or ApprovalApproveIn()
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
    if approval.channel == "email" and gmail_oauth_configured(settings):
        creds = (
            await session.execute(
                select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
            )
        ).scalar_one_or_none()
        if creds:
            built = draft_content_from_application(
                app.title,
                app.company,
                app.job_url,
                app.package_draft,
            )
            if built:
                subject, body_text = built
                try:
                    draft_resp = await create_draft_plain(
                        settings,
                        creds.refresh_token,
                        subject=subject,
                        body=body_text,
                        to=None,
                    )
                    did = draft_resp.get("id")
                    gmail_out = GmailDraftOut(
                        draft_id=did if isinstance(did, str) else "",
                        gmail_web_url="https://mail.google.com/mail/u/0/#drafts",
                    )
                except Exception:
                    logger.exception("approve_approval: Gmail draft creation failed")

    approval.status = "approved"
    if app.status not in {"applied", "interview", "offer", "closed"}:
        app.status = "applied"
    session.add(approval)
    session.add(app)
    await session.commit()
    await session.refresh(approval)
    await session.refresh(app)
    return ApprovalApproveOut(
        application=ApplicationOut.model_validate(app),
        gmail_draft=gmail_out,
    )


@router.post("/me/approvals/{approval_id}/reject", response_model=ApplicationOut)
async def reject_approval(
    approval_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
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
    return app
