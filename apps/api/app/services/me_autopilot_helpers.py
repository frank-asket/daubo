import hashlib
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID
from uuid import uuid4

from redis.asyncio import from_url as redis_from_url
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import AutopilotRun, UserAutopilotProfile, UserWorkspaceSettings

_AUTOPILOT_RUNNING_STALE_AFTER = timedelta(minutes=30)
_AUTOPILOT_IDEMPOTENCY_TTL = timedelta(hours=8)
_AUTOPILOT_LOCK_TTL_SECONDS = 5 * 60


def _is_autopilot_run_stale(started_at: datetime) -> bool:
    started_utc = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - started_utc > _AUTOPILOT_RUNNING_STALE_AFTER


def autopilot_conflict_detail(running: AutopilotRun) -> dict:
    started = running.started_at
    started_utc = started if started.tzinfo else started.replace(tzinfo=timezone.utc)
    return {
        "code": "autopilot_run_in_progress",
        "message": "A Smart prep run is already in progress. Wait for it to finish before starting another run.",
        "active_run_id": str(running.id),
        "started_at": started_utc.isoformat(),
    }


def normalize_idempotency_key(raw: str | None) -> str | None:
    key = (raw or "").strip()
    if not key:
        return None
    return key[:128]


def autopilot_request_fingerprint(
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


def autopilot_idempotency_active(started_at: datetime) -> bool:
    started_utc = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - started_utc <= _AUTOPILOT_IDEMPOTENCY_TTL


def autopilot_idempotency_decision(
    previous_fingerprint: str | None,
    request_fingerprint: str,
) -> str:
    prev_fp = (previous_fingerprint or "").strip()
    if not prev_fp:
        return "conflict_unverifiable"
    if prev_fp != request_fingerprint:
        return "conflict_mismatch"
    return "replay"


def classify_autopilot_item_error(status: str, error: str | None) -> str | None:
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


def autopilot_item_suggested_action(category: str | None) -> str | None:
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


def autopilot_item_retryable(status: str, category: str | None) -> bool:
    if status in {"failed", "prepared_draft_failed"}:
        return category != "validation_error"
    return False


def autopilot_item_latency_ms(created_at: datetime | None, updated_at: datetime | None) -> int | None:
    if created_at is None or updated_at is None:
        return None
    c = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    u = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
    delta = (u - c).total_seconds()
    if delta < 0:
        return None
    return int(delta * 1000)


async def get_or_create_workspace_settings(
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


async def get_or_create_autopilot_profile(
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


async def resolve_or_block_running_autopilot(
    session: AsyncSession,
    user_id: str,
) -> AutopilotRun | None:
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


async def acquire_autopilot_overlap_lock(redis_url: str, user_id: str) -> str | None:
    """Distributed short lock to block overlapping launches across workers."""
    token = str(uuid4())
    key = f"autopilot:lock:{user_id}"
    client = redis_from_url(redis_url, encoding="utf-8", decode_responses=True)
    try:
        ok = await client.set(key, token, ex=_AUTOPILOT_LOCK_TTL_SECONDS, nx=True)
        return token if ok else None
    finally:
        await client.aclose()


async def release_autopilot_overlap_lock(redis_url: str, user_id: str, token: str) -> None:
    key = f"autopilot:lock:{user_id}"
    client = redis_from_url(redis_url, encoding="utf-8", decode_responses=True)
    try:
        current = await client.get(key)
        if current == token:
            await client.delete(key)
    finally:
        await client.aclose()

