"""Redis-backed idempotency for POST /me/approvals/:id/approve and /reject."""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from redis.asyncio import from_url as redis_from_url

_IDEM_TTL_SECONDS = 8 * 3600
_LOCK_TTL_SECONDS = 120
_POLL_INTERVAL_S = 0.1
_POLL_MAX_WAIT_S = 3.0


def approval_approve_fingerprint(
    approval_id: UUID,
    *,
    cover_letter: str | None,
    linkedin_note: str | None,
) -> str:
    payload = {
        "approval_id": str(approval_id),
        "cover_letter": cover_letter,
        "linkedin_note": linkedin_note,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def approval_reject_fingerprint(approval_id: UUID) -> str:
    canonical = json.dumps(
        {"approval_id": str(approval_id), "op": "reject"},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cache_key(user_id: str, idem_key: str, op: Literal["approve", "reject"]) -> str:
    return f"daubo:approval:idem:{user_id}:{idem_key}:{op}"


def _lock_key(user_id: str, idem_key: str, op: Literal["approve", "reject"]) -> str:
    return f"daubo:approval:idem:{user_id}:{idem_key}:{op}:lock"


def require_redis_for_idempotency(redis_url: str, idem_key: str | None) -> None:
    if idem_key and not (redis_url or "").strip():
        raise HTTPException(
            status_code=503,
            detail="Idempotency-Key is set but Redis is not configured (REDIS_URL).",
        )


async def _redis_client(redis_url: str):
    return redis_from_url(redis_url.strip(), encoding="utf-8", decode_responses=True)


async def approval_idempotency_read(
    redis_url: str,
    *,
    user_id: str,
    idem_key: str,
    op: Literal["approve", "reject"],
    fingerprint: str,
) -> dict[str, Any] | None:
    """Return cached JSON response body if replay; None if no entry; 409 if fingerprint mismatch."""
    client = await _redis_client(redis_url)
    try:
        raw = await client.get(_cache_key(user_id, idem_key, op))
        if not raw:
            return None
        data = json.loads(raw)
        prev_fp = data.get("fingerprint")
        if prev_fp != fingerprint:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "idempotency_key_reused_with_different_payload",
                    "message": "Idempotency-Key was already used with different parameters for this approval.",
                },
            )
        body = data.get("response")
        if not isinstance(body, dict):
            return None
        return body
    finally:
        await client.aclose()


async def approval_idempotency_write(
    redis_url: str,
    *,
    user_id: str,
    idem_key: str,
    op: Literal["approve", "reject"],
    fingerprint: str,
    response: dict[str, Any],
) -> None:
    client = await _redis_client(redis_url)
    try:
        payload = json.dumps(
            {"fingerprint": fingerprint, "response": response},
            separators=(",", ":"),
        )
        await client.set(_cache_key(user_id, idem_key, op), payload, ex=_IDEM_TTL_SECONDS)
    finally:
        await client.aclose()


async def approval_idempotency_try_lock(
    redis_url: str,
    *,
    user_id: str,
    idem_key: str,
    op: Literal["approve", "reject"],
) -> str | None:
    """Return lock token if acquired; None if another request holds the lock."""
    token = str(uuid4())
    client = await _redis_client(redis_url)
    try:
        ok = await client.set(
            _lock_key(user_id, idem_key, op),
            token,
            nx=True,
            ex=_LOCK_TTL_SECONDS,
        )
        return token if ok else None
    finally:
        await client.aclose()


async def approval_idempotency_release_lock(
    redis_url: str,
    *,
    user_id: str,
    idem_key: str,
    op: Literal["approve", "reject"],
    token: str,
) -> None:
    lk = _lock_key(user_id, idem_key, op)
    client = await _redis_client(redis_url)
    try:
        current = await client.get(lk)
        if current == token:
            await client.delete(lk)
    finally:
        await client.aclose()


async def approval_idempotency_poll_cache(
    redis_url: str,
    *,
    user_id: str,
    idem_key: str,
    op: Literal["approve", "reject"],
    fingerprint: str,
) -> dict[str, Any] | None:
    """Wait for another in-flight request to populate the cache."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + _POLL_MAX_WAIT_S
    while loop.time() < deadline:
        await asyncio.sleep(_POLL_INTERVAL_S)
        got = await approval_idempotency_read(
            redis_url,
            user_id=user_id,
            idem_key=idem_key,
            op=op,
            fingerprint=fingerprint,
        )
        if got is not None:
            return got
    return None


def dump_model(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json")
