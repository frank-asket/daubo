from typing import Annotated

from fastapi import Header, HTTPException

from ..config import get_settings


async def get_clerk_user_id(
    x_daubo_user_id: Annotated[str | None, Header(alias="X-Daubo-User-Id")] = None,
) -> str:
    raw = (x_daubo_user_id or "").strip()
    if raw:
        return raw
    settings = get_settings()
    fb = (settings.dev_fallback_user_id or "").strip()
    if fb and not settings.is_production:
        return fb
    raise HTTPException(status_code=401, detail="Missing X-Daubo-User-Id")
