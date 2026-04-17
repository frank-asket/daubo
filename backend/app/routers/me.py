import csv
import hashlib
import json
import logging
from io import StringIO
from uuid import UUID
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_db
from app.deps.users import get_clerk_user_id
from app.models import (
    AgentMatchRun,
    AutopilotRun,
    AutopilotRunItem,
    JobApplication,
    UserAutopilotProfile,
    UserGmailCredentials,
    UserProfileDocument,
    UserResume,
    UserWorkspaceSettings,
)
from app.schemas.me import (
    PROFILE_DOC_KINDS,
    ApplicationCreate,
    ApplicationsIntegrityIn,
    ApplicationsIntegrityOut,
    ApplicationOut,
    ApplicationPackageRequest,
    ApplicationUpdate,
    AutopilotProfileOut,
    AutopilotProfilePatch,
    AutopilotRunIn,
    AutopilotRunItemOut,
    AutopilotRunOut,
    AutopilotRunRecordOut,
    GmailDraftOut,
    GmailOAuthCompleteIn,
    GmailOAuthCompleteOut,
    GmailStatusOut,
    ProfileDocumentOut,
    ResumeIn,
    ResumeOut,
    ResumeProfileStoredOut,
    ResumeUploadOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)
from app.services.application_package import (
    generate_application_package,
    generate_interview_prep,
    package_summary_text,
)
from app.services.prep_session_service import record_prep_generation
from app.services.autopilot import run_autopilot_pass
from app.services.pipeline_integrity import run_pipeline_integrity_pass
from app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    exchange_authorization_code,
    fetch_google_email,
    gmail_oauth_configured,
)
from app.schemas.jobs import DiscoverHintsOut
from app.services.profile_documents_context import profile_documents_prompt_block
from app.services.resume_auto_match import (
    infer_job_discover_params_from_resume_text,
    schedule_resume_auto_match,
)
from app.services.resume_ingest import extract_resume_text
from app.services.resume_kickoff import agent_ack_after_resume_upload
from app.services.resume_profile_signals import ResumeProfileSignals
from app.services.resume_profile_store import (
    get_or_refresh_resume_profile_signals,
    persist_resume_profile_signals,
    signals_from_row,
)

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")

_AUTODISCOVER_KIND = "resume_autodiscover"
_AUTOPILOT_RUNNING_STALE_AFTER = timedelta(minutes=30)
_AUTOPILOT_IDEMPOTENCY_TTL = timedelta(hours=8)


def _is_autopilot_run_stale(started_at: datetime) -> bool:
    started_utc = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - started_utc > _AUTOPILOT_RUNNING_STALE_AFTER


def _autopilot_conflict_detail(running: AutopilotRun) -> dict:
    started = running.started_at
    started_utc = started if started.tzinfo else started.replace(tzinfo=timezone.utc)
    return {
        "code": "autopilot_run_in_progress",
        "message": "A Smart prep run is already in progress. Wait for it to finish before starting another run.",
        "active_run_id": str(running.id),
        "started_at": started_utc.isoformat(),
    }


def _normalize_idempotency_key(raw: str | None) -> str | None:
    key = (raw or "").strip()
    if not key:
        return None
    return key[:128]


def _autopilot_request_fingerprint(
    *,
    limit: int,
    create_gmail_drafts: bool,
    retry_scope: str | None,
    source_run_id: UUID | None,
) -> str:
    payload = {
        "limit": limit,
        "create_gmail_drafts": bool(create_gmail_drafts),
        "retry_scope": retry_scope or None,
        "source_run_id": str(source_run_id) if source_run_id is not None else None,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _autopilot_idempotency_active(started_at: datetime) -> bool:
    started_utc = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - started_utc <= _AUTOPILOT_IDEMPOTENCY_TTL


def _autopilot_idempotency_decision(
    previous_fingerprint: str | None,
    request_fingerprint: str,
) -> str:
    """
    Decide behavior for a reused Idempotency-Key.

    Returns one of:
    - "replay": safe to return previous run result
    - "conflict_unverifiable": previous run cannot be validated (missing fingerprint)
    - "conflict_mismatch": previous run fingerprint differs from current request
    """
    prev_fp = (previous_fingerprint or "").strip()
    if not prev_fp:
        return "conflict_unverifiable"
    if prev_fp != request_fingerprint:
        return "conflict_mismatch"
    return "replay"


def _classify_autopilot_item_error(status: str, error: str | None) -> str | None:
    if status == "prepared_draft_failed":
        return "gmail_error"
    if status != "failed":
        return None
    msg = (error or "").lower()
    if "resume" in msg:
        return "missing_resume"
    if "openrouter" in msg or "llm" in msg or "model" in msg:
        return "llm_error"
    if "gmail" in msg:
        return "gmail_error"
    if "validation" in msg or "invalid" in msg:
        return "validation_error"
    return "runtime_error"


def _autopilot_item_suggested_action(category: str | None) -> str | None:
    if category == "missing_resume":
        return "Upload/update your resume, then retry failed items."
    if category == "llm_error":
        return "Retry in a minute; if it persists, verify OpenRouter credentials."
    if category == "gmail_error":
        return "Reconnect Gmail in Settings, then retry Gmail draft failures."
    if category == "validation_error":
        return "Review job details (URL/description/channel), then retry."
    if category == "runtime_error":
        return "Retry failed items; if it repeats, contact support with run id."
    return None


def _autopilot_item_retryable(status: str, category: str | None) -> bool:
    if status in {"failed", "prepared_draft_failed"}:
        return category != "validation_error"
    return False


def _autopilot_item_latency_ms(created_at: datetime | None, updated_at: datetime | None) -> int | None:
    if created_at is None or updated_at is None:
        return None
    c = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    u = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
    delta = (u - c).total_seconds()
    if delta < 0:
        return None
    return int(delta * 1000)


def _normalize_profile_doc_kind(raw: str) -> str:
    k = (raw or "").strip().lower()
    if k not in PROFILE_DOC_KINDS:
        raise HTTPException(
            status_code=400,
            detail="doc_kind must be one of: certification, degree, other.",
        )
    return k


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


async def _get_or_create_autopilot_profile(
    session: AsyncSession,
    user_id: str,
) -> UserAutopilotProfile:
    result = await session.execute(
        select(UserAutopilotProfile).where(UserAutopilotProfile.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = UserAutopilotProfile(clerk_user_id=user_id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def _resolve_or_block_running_autopilot(
    session: AsyncSession,
    user_id: str,
) -> AutopilotRun | None:
    """Serialize launch checks and prevent overlapping runs for one user."""
    # Row lock on per-user profile ensures rapid concurrent clicks are serialized.
    await session.execute(
        select(UserAutopilotProfile)
        .where(UserAutopilotProfile.clerk_user_id == user_id)
        .with_for_update()
    )
    result = await session.execute(
        select(AutopilotRun)
        .where(
            AutopilotRun.clerk_user_id == user_id,
            AutopilotRun.status == "running",
        )
        .order_by(AutopilotRun.started_at.desc())
        .limit(1)
    )
    running = result.scalar_one_or_none()
    if running is None:
        return None

    if _is_autopilot_run_stale(running.started_at):
        running.status = "failed"
        prev_errors = running.errors if isinstance(running.errors, list) else []
        running.errors = list(prev_errors) + [
            "Run auto-closed as stale before starting a new one."
        ]
        running.finished_at = datetime.now(timezone.utc)
        session.add(running)
        await session.commit()
        return None
    return running


class AgentMatchLatestResponse(BaseModel):
    run: dict | None = None
    created_at: str | None = None


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
    settings: Settings = Depends(get_settings),
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
    await persist_resume_profile_signals(session, settings, user_id, row.content_text)
    return row


@router.post("/me/resume/trigger-auto-match")
async def trigger_resume_auto_match(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Queue a background résumé→job match (same pipeline as after upload). Respects server cooldown."""
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None or not (row.content_text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Add your résumé first — matching uses your saved CV text.",
        )
    schedule_resume_auto_match(user_id)
    return {"queued": True}


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


@router.get("/me/discover/hints", response_model=DiscoverHintsOut)
async def discover_hints_from_resume(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DiscoverHintsOut:
    if not (settings.openrouter_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured — resume-based hints require the AI service.",
        )
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None or not (row.content_text or "").strip():
        raise HTTPException(
            status_code=404,
            detail="Add your résumé first — we use it to infer country, nearby markets, and global/remote angles.",
        )
    try:
        params = await infer_job_discover_params_from_resume_text(settings, row.content_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    excerpt = row.content_text.strip()[:12_000]
    return DiscoverHintsOut(
        country=params.country,
        country_code=params.country_code,
        city_or_region=params.city_or_region,
        industries=params.industries,
        role_focus=params.role_focus,
        languages=params.languages,
        additional_country_codes=params.additional_country_codes,
        emphasize_remote_global=params.emphasize_remote_global,
        resume_excerpt=excerpt,
    )


@router.get("/me/resume/profile", response_model=ResumeProfileStoredOut)
async def get_resume_profile_snapshot(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> ResumeProfileStoredOut:
    """Persisted skills + context from the saved résumé (no LLM on read)."""
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None or not (row.content_text or "").strip():
        return ResumeProfileStoredOut(has_resume=False)
    signals, stale = signals_from_row(row)
    return ResumeProfileStoredOut(
        has_resume=True,
        signals=signals,
        stale=stale,
        resume_updated_at=row.updated_at,
        profile_extracted_at=row.profile_extracted_at,
    )


@router.post("/me/resume/profile/refresh", response_model=ResumeProfileSignals)
async def refresh_resume_profile(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ResumeProfileSignals:
    """Re-run LLM extraction and persist (e.g. after editing résumé text)."""
    if not (settings.openrouter_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured — profile extraction requires the AI service.",
        )
    try:
        return await get_or_refresh_resume_profile_signals(
            session, settings, user_id, force_refresh=True
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("refresh_resume_profile failed")
        raise HTTPException(
            status_code=502,
            detail="Could not refresh profile right now. Try again in a moment.",
        ) from None


@router.get("/me/resume/profile-signals", response_model=ResumeProfileSignals)
async def resume_profile_signals(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    refresh: bool = Query(False, description="If true, re-run extraction even when cache is fresh."),
) -> ResumeProfileSignals:
    """Structured skills + career context from the saved résumé (cached; LLM when stale or refresh)."""
    if not (settings.openrouter_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured — profile signals require the AI service.",
        )
    try:
        return await get_or_refresh_resume_profile_signals(
            session, settings, user_id, force_refresh=refresh
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("resume_profile_signals extraction failed")
        raise HTTPException(
            status_code=502,
            detail="Could not extract profile signals right now. Try again in a moment.",
        ) from None


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
    await persist_resume_profile_signals(session, settings, user_id, row.content_text)
    agent_reply = await agent_ack_after_resume_upload(settings)
    return ResumeUploadOut(
        id=row.id,
        clerk_user_id=row.clerk_user_id,
        content_text=row.content_text,
        file_name=row.file_name,
        updated_at=row.updated_at,
        agent_reply=agent_reply,
    )


@router.get("/me/profile-documents", response_model=list[ProfileDocumentOut])
async def list_profile_documents(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[UserProfileDocument]:
    result = await session.execute(
        select(UserProfileDocument)
        .where(UserProfileDocument.clerk_user_id == user_id)
        .order_by(UserProfileDocument.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("/me/profile-documents/upload", response_model=ProfileDocumentOut)
async def upload_profile_document(
    file: UploadFile = File(...),
    doc_kind: str = Form(...),
    label: str | None = Form(None),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserProfileDocument:
    kind = _normalize_profile_doc_kind(doc_kind)
    raw = await file.read()
    name = (file.filename or "document").strip() or "document"
    try:
        content_text = await extract_resume_text(raw, name, file.content_type, settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("profile document ingest failed")
        raise HTTPException(
            status_code=502,
            detail="Could not process this file. Try PDF, Word, or paste-friendly formats.",
        ) from None

    if len(content_text) > 500_000:
        content_text = content_text[:500_000]

    label_clean = (label or "").strip()[:300] or None
    row = UserProfileDocument(
        clerk_user_id=user_id,
        doc_kind=kind,
        label=label_clean,
        file_name=name[:512],
        content_text=content_text,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/me/profile-documents/{document_id}", status_code=204)
async def delete_profile_document(
    document_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        select(UserProfileDocument).where(
            UserProfileDocument.id == document_id,
            UserProfileDocument.clerk_user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    await session.delete(row)
    await session.commit()


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
    """UTF-8 CSV of saved jobs for spreadsheets (Google Sheets, Excel)."""
    result = await session.execute(
        select(JobApplication)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.desc())
    )
    rows = list(result.scalars().all())
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "id",
            "title",
            "company",
            "location",
            "status",
            "job_url",
            "notes",
            "apply_channel",
            "updated_at",
        ],
    )
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
            ],
        )
    body = "\ufeff" + buf.getvalue()
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="daubo-my-jobs.csv"',
        },
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
            select(func.count())
            .select_from(JobApplication)
            .where(JobApplication.clerk_user_id == user_id)
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
    supplementary = await profile_documents_prompt_block(session, user_id)

    try:
        package = await generate_application_package(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            location=row.location,
            job_description=jd,
            apply_channel=channel,
            supplementary_profile=supplementary or None,
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
    supplementary = await profile_documents_prompt_block(session, user_id)
    try:
        prep = await generate_interview_prep(
            settings,
            resume_text=resume_row.content_text,
            title=row.title,
            company=row.company,
            job_description=row.job_description,
            package_summary=summary,
            supplementary_profile=supplementary or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
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
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
) -> AutopilotRunOut:
    req = body or AutopilotRunIn()
    profile = await _get_or_create_autopilot_profile(session, user_id)
    effective_limit = min(req.limit, profile.daily_apply_limit)
    # Resolve workspace prefs before entering the overlap-guard critical section because
    # this helper may create a row and commit (which would otherwise release our lock).
    ws = await _get_or_create_workspace_settings(session, user_id)
    do_gmail = (
        req.create_gmail_drafts
        if req.create_gmail_drafts is not None
        else ws.autopilot_auto_gmail_drafts
    )
    idem_key = _normalize_idempotency_key(idempotency_key_header)
    req_fingerprint = _autopilot_request_fingerprint(
        limit=effective_limit,
        create_gmail_drafts=do_gmail,
        retry_scope=req.retry_scope,
        source_run_id=req.source_run_id,
    )
    if idem_key is not None:
        prev_res = await session.execute(
            select(AutopilotRun)
            .where(
                AutopilotRun.clerk_user_id == user_id,
                AutopilotRun.idempotency_key == idem_key,
            )
            .order_by(AutopilotRun.started_at.desc())
            .limit(1)
        )
        prev = prev_res.scalar_one_or_none()
        if prev is not None and _autopilot_idempotency_active(prev.started_at):
            started_iso = (
                prev.started_at
                if prev.started_at.tzinfo
                else prev.started_at.replace(tzinfo=timezone.utc)
            ).isoformat()
            decision = _autopilot_idempotency_decision(
                previous_fingerprint=prev.request_fingerprint,
                request_fingerprint=req_fingerprint,
            )
            if decision == "conflict_unverifiable":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "idempotency_key_reused_unverifiable_payload",
                        "message": (
                            "Idempotency key matches an older run that lacks a request fingerprint. "
                            "Use a new Idempotency-Key for this request."
                        ),
                        "active_run_id": str(prev.id),
                        "started_at": started_iso,
                    },
                )
            if decision == "conflict_mismatch":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "idempotency_key_reused_with_different_payload",
                        "message": "Idempotency key was already used with different run parameters.",
                        "active_run_id": str(prev.id),
                        "started_at": started_iso,
                    },
                )
            now = datetime.now(timezone.utc)
            prev.last_replayed_at = now
            session.add(prev)
            await session.commit()
            return AutopilotRunOut(
                run_id=prev.id,
                status=prev.status,
                processed=prev.processed,
                gmail_drafts_created=prev.gmail_drafts_created,
                errors=prev.errors if isinstance(prev.errors, list) else [],
                fresh_run=False,
                replayed_at=now,
            )
    # From this point to run creation commit, do not call helpers that may commit before
    # the new "running" row is inserted; that would release the launch lock too early.
    running = await _resolve_or_block_running_autopilot(session, user_id)
    if running is not None:
        raise HTTPException(
            status_code=409,
            detail=_autopilot_conflict_detail(running),
        )
    run = AutopilotRun(
        clerk_user_id=user_id,
        idempotency_key=idem_key,
        request_fingerprint=req_fingerprint,
        status="running",
        requested_limit=effective_limit,
        create_gmail_drafts=do_gmail,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    try:
        out = await run_autopilot_pass(
            session,
            user_id,
            settings,
            limit=effective_limit,
            create_gmail_drafts=do_gmail,
            run_id=run.id,
            retry_scope=req.retry_scope,
            source_run_id=req.source_run_id,
        )
    except ValueError as exc:
        run.status = "failed"
        run.errors = [str(exc)]
        run.finished_at = datetime.now(timezone.utc)
        await session.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        run.status = "failed"
        run.errors = ["Autopilot run failed unexpectedly."]
        run.finished_at = datetime.now(timezone.utc)
        await session.commit()
        raise
    run.status = "completed"
    run.processed = out["processed"]
    run.gmail_drafts_created = out["gmail_drafts_created"]
    run.errors = out["errors"]
    run.finished_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)
    return AutopilotRunOut(
        run_id=run.id,
        status=run.status,
        processed=out["processed"],
        gmail_drafts_created=out["gmail_drafts_created"],
        errors=out["errors"],
        fresh_run=True,
        replayed_at=None,
    )


@router.get("/me/autopilot/profile", response_model=AutopilotProfileOut)
async def get_autopilot_profile(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserAutopilotProfile:
    return await _get_or_create_autopilot_profile(session, user_id)


@router.patch("/me/autopilot/profile", response_model=AutopilotProfileOut)
async def patch_autopilot_profile(
    body: AutopilotProfilePatch,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserAutopilotProfile:
    row = await _get_or_create_autopilot_profile(session, user_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    await session.commit()
    await session.refresh(row)
    return row


@router.get("/me/autopilot/runs", response_model=list[AutopilotRunRecordOut])
async def list_autopilot_runs(
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[AutopilotRun]:
    result = await session.execute(
        select(AutopilotRun)
        .where(AutopilotRun.clerk_user_id == user_id)
        .order_by(AutopilotRun.started_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/me/autopilot/runs/{run_id}/items", response_model=list[AutopilotRunItemOut])
async def list_autopilot_run_items(
    run_id: UUID,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[AutopilotRunItemOut]:
    run_res = await session.execute(
        select(AutopilotRun).where(
            AutopilotRun.id == run_id,
            AutopilotRun.clerk_user_id == user_id,
        )
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Autopilot run not found")
    result = await session.execute(
        select(AutopilotRunItem)
        .where(
            AutopilotRunItem.run_id == run_id,
            AutopilotRunItem.clerk_user_id == user_id,
        )
        .order_by(AutopilotRunItem.updated_at.desc())
    )
    rows = list(result.scalars().all())
    out: list[AutopilotRunItemOut] = []
    for row in rows:
        category = _classify_autopilot_item_error(row.status, row.error)
        out.append(
            AutopilotRunItemOut(
                id=row.id,
                run_id=row.run_id,
                clerk_user_id=row.clerk_user_id,
                application_id=row.application_id,
                title=row.title,
                company=row.company,
                job_url=row.job_url,
                status=row.status,
                error=row.error,
                error_category=category,
                retryable=_autopilot_item_retryable(row.status, category),
                suggested_action=_autopilot_item_suggested_action(category),
                latency_ms=_autopilot_item_latency_ms(row.created_at, row.updated_at),
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )
    return out
