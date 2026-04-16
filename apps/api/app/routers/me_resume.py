import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.schemas.me_resume import (
    AgentMatchLatestResponse,
    PROFILE_DOC_KINDS,
    ProfileDocumentOut,
    ResumeIn,
    ResumeOut,
    ResumeProfileStoredOut,
    ResumeUploadOut,
)
from app.services.resume_ingest import extract_resume_text
from app.services.resume_profile_signals import ResumeProfileSignals
from app.services.resume_profile_store import (
    get_or_refresh_resume_profile_signals,
    persist_resume_profile_signals,
    signals_from_row,
)
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import AgentMatchRun, UserProfileDocument, UserResume
from backend.app.schemas.jobs import DiscoverHintsOut
from backend.app.services.resume_auto_match import (
    infer_job_discover_params_from_resume_text,
    schedule_resume_auto_match,
)
from backend.app.services.resume_kickoff import agent_ack_after_resume_upload

router = APIRouter(tags=["me"])
logger = logging.getLogger("daubo")
_AUTODISCOVER_KIND = "resume_autodiscover"


def _normalize_profile_doc_kind(raw: str) -> str:
    k = (raw or "").strip().lower()
    if k not in PROFILE_DOC_KINDS:
        raise HTTPException(status_code=400, detail="doc_kind must be one of: certification, degree, other.")
    return k


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
        row = UserResume(clerk_user_id=user_id, content_text=body.content_text, file_name=body.file_name)
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
    result = await session.execute(select(UserResume).where(UserResume.clerk_user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None or not (row.content_text or "").strip():
        raise HTTPException(status_code=400, detail="Add your resume first — matching uses your saved CV text.")
    schedule_resume_auto_match(user_id)
    return {"queued": True}


@router.get("/me/agent-match/latest", response_model=AgentMatchLatestResponse)
async def latest_agent_match(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> AgentMatchLatestResponse:
    result = await session.execute(
        select(AgentMatchRun)
        .where(AgentMatchRun.clerk_user_id == user_id, AgentMatchRun.kind == _AUTODISCOVER_KIND)
        .order_by(AgentMatchRun.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return AgentMatchLatestResponse(run=None, created_at=None)
    return AgentMatchLatestResponse(run=row.payload, created_at=row.created_at.isoformat() if row.created_at else None)


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
            detail="Add your resume first — we use it to infer country, nearby markets, and global/remote angles.",
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
    if not (settings.openrouter_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured — profile extraction requires the AI service.",
        )
    try:
        return await get_or_refresh_resume_profile_signals(session, settings, user_id, force_refresh=True)
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
    if not (settings.openrouter_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured — profile signals require the AI service.",
        )
    try:
        return await get_or_refresh_resume_profile_signals(session, settings, user_id, force_refresh=refresh)
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
        row = UserResume(clerk_user_id=user_id, content_text=content_text, file_name=name[:512])
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

