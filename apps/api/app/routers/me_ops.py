from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.services.autopilot import run_autopilot_pass
from app.services.me_autopilot_helpers import (
    acquire_autopilot_overlap_lock,
    autopilot_conflict_detail,
    autopilot_idempotency_active,
    autopilot_idempotency_decision,
    autopilot_item_latency_ms,
    autopilot_item_retryable,
    autopilot_item_suggested_action,
    autopilot_request_fingerprint,
    classify_autopilot_item_error,
    get_or_create_autopilot_profile,
    get_or_create_workspace_settings,
    normalize_idempotency_key,
    release_autopilot_overlap_lock,
    resolve_or_block_running_autopilot,
)
from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import (
    AutopilotRun,
    AutopilotRunItem,
    UserAutopilotProfile,
    UserGmailCredentials,
)
from app.schemas.me_ops import (
    AutopilotProfileOut,
    AutopilotProfilePatch,
    AutopilotRunIn,
    AutopilotRunItemOut,
    AutopilotRunOut,
    AutopilotRunRecordOut,
    GmailOAuthCompleteIn,
    GmailOAuthCompleteOut,
    GmailStatusOut,
    WorkspaceSettingsOut,
    WorkspaceSettingsPatch,
)
from backend.app.services.gmail_integration import (
    exchange_authorization_code,
    fetch_google_email,
    gmail_oauth_configured,
)

router = APIRouter(tags=["me"])


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
        raise HTTPException(
            status_code=502,
            detail="Could not complete Google sign-in. Try again or check redirect URI matches.",
        ) from exc

    refresh = token_payload.get("refresh_token")
    if not isinstance(refresh, str) or not refresh.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "Google did not return a refresh token. In Google Account -> Security -> Third-party "
                "access, remove Daubo for this app, then connect again (we request offline access)."
            ),
        )

    access = token_payload.get("access_token")
    email: str | None = None
    if isinstance(access, str):
        try:
            email = await fetch_google_email(access)
        except Exception:
            email = None

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


@router.get("/me/workspace-settings", response_model=WorkspaceSettingsOut)
async def get_workspace_settings(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await get_or_create_workspace_settings(session, user_id)


@router.patch("/me/workspace-settings", response_model=WorkspaceSettingsOut)
async def patch_workspace_settings(
    body: WorkspaceSettingsPatch,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
):
    row = await get_or_create_workspace_settings(session, user_id)
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
    profile = await get_or_create_autopilot_profile(session, user_id)
    effective_limit = min(req.limit, profile.daily_apply_limit)
    ws = await get_or_create_workspace_settings(session, user_id)
    do_gmail = (
        req.create_gmail_drafts
        if req.create_gmail_drafts is not None
        else ws.autopilot_auto_gmail_drafts
    )
    idem_key = normalize_idempotency_key(idempotency_key_header)
    req_fingerprint = autopilot_request_fingerprint(
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
        if prev is not None and autopilot_idempotency_active(prev.started_at):
            started_iso = (
                prev.started_at if prev.started_at.tzinfo else prev.started_at.replace(tzinfo=timezone.utc)
            ).isoformat()
            decision = autopilot_idempotency_decision(
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
            return AutopilotRunOut(
                run_id=prev.id,
                status=prev.status,
                processed=prev.processed,
                gmail_drafts_created=prev.gmail_drafts_created,
                errors=prev.errors if isinstance(prev.errors, list) else [],
            )
    lock_token = await acquire_autopilot_overlap_lock(settings.redis_url, user_id)
    if lock_token is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "autopilot_run_overlap_locked",
                "message": "Another autopilot launch is currently in progress. Try again shortly.",
            },
        )
    try:
        running = await resolve_or_block_running_autopilot(session, user_id)
        if running is not None:
            raise HTTPException(status_code=409, detail=autopilot_conflict_detail(running))
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
        )
    finally:
        await release_autopilot_overlap_lock(settings.redis_url, user_id, lock_token)


@router.get("/me/autopilot/profile", response_model=AutopilotProfileOut)
async def get_autopilot_profile(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserAutopilotProfile:
    return await get_or_create_autopilot_profile(session, user_id)


@router.patch("/me/autopilot/profile", response_model=AutopilotProfileOut)
async def patch_autopilot_profile(
    body: AutopilotProfilePatch,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserAutopilotProfile:
    row = await get_or_create_autopilot_profile(session, user_id)
    for k, v in body.model_dump(exclude_unset=True).items():
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
        category = classify_autopilot_item_error(row.status, row.error)
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
                retryable=autopilot_item_retryable(row.status, category),
                suggested_action=autopilot_item_suggested_action(category),
                latency_ms=autopilot_item_latency_ms(row.created_at, row.updated_at),
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )
    return out

