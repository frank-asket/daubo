"""Per-user (or per-IP) request rate limiting using Redis with in-process fallback."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger("daubo.ratelimit")

# Fixed-window counters when Redis is unavailable (per-process only).
_memory_buckets: dict[str, tuple[int, int]] = {}


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _rate_key(request: Request) -> str:
    uid = (request.headers.get("X-Daubo-User-Id") or "").strip()
    if uid:
        return f"u:{uid}"
    return f"ip:{_client_ip(request)}"


def _should_skip_path(path: str) -> bool:
    if path == "/health" or path.startswith("/v1/health"):
        return True
    if path == "/metrics":
        return True
    if path in ("/docs", "/redoc", "/openapi.json"):
        return True
    if path.startswith("/modelui"):
        return True
    return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self._settings = settings
        self._redis = None

    async def _get_redis(self):
        if self._redis is not False and self._settings.rate_limit_use_redis:
            try:
                from redis.asyncio import from_url as redis_from_url

                if self._redis is None:
                    self._redis = redis_from_url(
                        self._settings.redis_url.strip(),
                        encoding="utf-8",
                        decode_responses=True,
                    )
                return self._redis
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis rate limit unavailable, using memory: %s", exc)
                self._redis = False
        return None

    async def _allow(self, key: str) -> bool:
        limit = self._settings.rate_limit_per_minute
        if limit <= 0:
            return True

        bucket = int(time.time() // 60)
        rkey = f"rl:{bucket}:{key}"

        client = await self._get_redis()
        if client is not None:
            try:
                n = await client.incr(rkey)
                if n == 1:
                    await client.expire(rkey, 120)
                return n <= limit
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis rate limit error, using memory: %s", exc)

        # Memory fallback (single worker only)
        prev = _memory_buckets.get(key, (0, bucket))
        count, prev_bucket = prev
        if prev_bucket != bucket:
            count = 0
        count += 1
        _memory_buckets[key] = (count, bucket)
        return count <= limit

    async def dispatch(self, request: Request, call_next) -> Response:
        s = self._settings
        if not s.rate_limit_enabled:
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path or ""
        if _should_skip_path(path):
            return await call_next(request)

        key = _rate_key(request)
        if not await self._allow(key):
            rid = getattr(request.state, "request_id", None)
            body: dict = {"detail": "Rate limit exceeded"}
            if rid:
                body["request_id"] = rid
            return JSONResponse(status_code=429, content=body)

        return await call_next(request)
