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
from app.models import (
    AgentMatchRun,
    JobApplication,
    UserGmailCredentials,
    UserResume,
    UserWorkspaceSettings,
)
from app.schemas.me import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationPackageRequest,
    ApplicationUpdate,
    AutopilotRunIn,
    AutopilotRunOut,
    GmailDraftOut,
    GmailOAuthCompleteIn,
    GmailOAuthCompleteOut,
    GmailStatusOut,
    ResumeIn,
    ResumeOut,
    ResumeUploadOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)
from app.services.application_package import (
    generate_application_package,
    generate_interview_prep,
    package_summary_text,
)
from app.services.autopilot import run_autopilot_pass
from app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    exchange_authorization_code,
    fetch_google_email,
    gmail_oauth_configured,
)
from app.services.resume_auto_match import schedule_resume_auto_match
from app.services.resume_ingest import extract_resume_text
from app.services.resume_kickoff import agent_ack_after_resume_upload

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")

_AUTODISCOVER_KIND = "resume_autodiscover"


async def _get_or_create_workspace_settings(
    session: AsyncSession,
    user_id: str,
) -> UserWorkspaceSettings:
    result = await session.execute(
        select(UserWorkspaceSettings).where(UserWorkspaceSettings.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = UserWorkspaceSettings(clerk_user_id=user_id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


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


@router.post(
    "/me/applications/{application_id}/application-package",
    response_model=ApplicationOut,
)
async def build_application_package(
    application_id: UUID,
    body: ApplicationPackageRequest | None = None,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JobApplication:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")

    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    resume_row = result.scalar_one_or_none()
    if not resume_row or not (resume_row.content_text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Upload or save a resume first so Daubo can tailor your application package.",
        )

    result = await session.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.clerk_user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    req = body or ApplicationPackageRequest()
    if req.job_description is not None:
        row.job_description = req.job_description
    if req.apply_channel is not None:
        row.apply_channel = req.apply_channel
    jd = row.job_description
    channel = row.apply_channel

    try:
        package = await generate_application_package(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            location=row.location,
            job_description=jd,
            apply_channel=channel,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("build_application_package failed")
        raise HTTPException(status_code=502, detail="Could not generate application package") from exc

    row.package_draft = package
    frozen = {"applied", "interview", "offer", "closed"}
    if row.status not in frozen:
        row.status = "package_ready"
    await session.commit()
    await session.refresh(row)
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

    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    resume_row = result.scalar_one_or_none()
    if not resume_row or not (resume_row.content_text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Upload or save a resume first so interview prep can use your profile.",
        )

    result = await session.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.clerk_user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    summary = package_summary_text(row.package_draft)
    try:
        prep = await generate_interview_prep(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            job_description=row.job_description,
            package_summary=summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("build_interview_prep failed")
        raise HTTPException(status_code=502, detail="Could not generate interview prep") from exc

    row.interview_prep = prep
    await session.commit()
    await session.refresh(row)
    return row


@router.get("/me/integrations/gmail/status", response_model=GmailStatusOut)
async def gmail_connection_status(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GmailStatusOut:
    configured = gmail_oauth_configured(settings)
    if not configured:
        return GmailStatusOut(configured=False, connected=False, google_email=None)
    result = await session.execute(
        select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    return GmailStatusOut(
        configured=configured,
        connected=row is not None,
        google_email=row.google_email if row else None,
    )


@router.post("/me/integrations/gmail/oauth-complete", response_model=GmailOAuthCompleteOut)
async def gmail_oauth_complete(
    body: GmailOAuthCompleteIn,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GmailOAuthCompleteOut:
    if not gmail_oauth_configured(settings):
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured on the API (set GOOGLE_OAUTH_*).",
        )
    try:
        token_payload = await exchange_authorization_code(settings, body.code)
    except Exception as exc:  # noqa: BLE001
        logger.exception("gmail oauth code exchange failed")
        raise HTTPException(
            status_code=502,
            detail="Could not complete Google sign-in. Try again or check redirect URI matches.",
        ) from exc

    refresh = token_payload.get("refresh_token")
    if not isinstance(refresh, str) or not refresh.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "Google did not return a refresh token. In Google Account → Security → Third-party "
                "access, remove Daubo for this app, then connect again (we request offline access)."
            ),
        )

    access = token_payload.get("access_token")
    email: str | None = None
    if isinstance(access, str):
        try:
            email = await fetch_google_email(access)
        except Exception:
            logger.exception("fetch google email after oauth")

    result = await session.execute(
        select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        row.refresh_token = refresh.strip()
        row.google_email = email
    else:
        row = UserGmailCredentials(
            clerk_user_id=user_id,
            refresh_token=refresh.strip(),
            google_email=email,
        )
        session.add(row)
    await session.commit()
    return GmailOAuthCompleteOut(connected=True, google_email=email)


@router.delete("/me/integrations/gmail", status_code=204)
async def gmail_disconnect(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        await session.delete(row)
        await session.commit()


@router.post("/me/applications/{application_id}/gmail-draft", response_model=GmailDraftOut)
async def create_gmail_draft_for_application(
    application_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GmailDraftOut:
    if not gmail_oauth_configured(settings):
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured on the API.",
        )
    result = await session.execute(
        select(UserGmailCredentials).where(UserGmailCredentials.clerk_user_id == user_id)
    )
    creds = result.scalar_one_or_none()
    if not creds:
        raise HTTPException(
            status_code=400,
            detail="Connect Gmail under Settings before creating a draft.",
        )

    result = await session.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.clerk_user_id == user_id,
        )
    )
    app_row = result.scalar_one_or_none()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    pkg = app_row.package_draft if isinstance(app_row.package_draft, dict) else {}
    built = draft_content_from_application(
        app_row.title,
        app_row.company,
        app_row.job_url,
        pkg,
    )
    if not built:
        raise HTTPException(
            status_code=400,
            detail="Generate an application package with email/cover text first.",
        )
    subject, body_text = built

    try:
        draft_resp = await create_draft_plain(
            settings,
            creds.refresh_token,
            subject=subject,
            body=body_text,
            to=None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("gmail draft creation failed")
        raise HTTPException(
            status_code=502,
            detail="Gmail refused the draft. Reconnect Gmail under Settings or try again.",
        ) from exc

    draft_id = draft_resp.get("id")
    if not isinstance(draft_id, str):
        draft_id = ""
    return GmailDraftOut(
        draft_id=draft_id,
        gmail_web_url="https://mail.google.com/mail/u/0/#drafts",
    )


@router.get("/me/workspace-settings", response_model=WorkspaceSettingsOut)
async def get_workspace_settings(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserWorkspaceSettings:
    return await _get_or_create_workspace_settings(session, user_id)


@router.patch("/me/workspace-settings", response_model=WorkspaceSettingsOut)
async def patch_workspace_settings(
    body: WorkspaceSettingsPatch,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserWorkspaceSettings:
    row = await _get_or_create_workspace_settings(session, user_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    await session.commit()
    await session.refresh(row)
    return row


@router.post("/me/autopilot/run", response_model=AutopilotRunOut)
async def run_prep_autopilot(
    body: AutopilotRunIn | None = None,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AutopilotRunOut:
    req = body or AutopilotRunIn()
    ws = await _get_or_create_workspace_settings(session, user_id)
    do_gmail = (
        req.create_gmail_drafts
        if req.create_gmail_drafts is not None
        else ws.autopilot_auto_gmail_drafts
    )
    try:
        out = await run_autopilot_pass(
            session,
            user_id,
            settings,
            limit=req.limit,
            create_gmail_drafts=do_gmail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AutopilotRunOut(
        processed=out["processed"],
        gmail_drafts_created=out["gmail_drafts_created"],
        errors=out["errors"],
    )
