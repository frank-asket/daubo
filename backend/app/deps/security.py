from typing import Annotated

from fastapi import Header, HTTPException

from app.config import get_settings


async def require_internal_api_key(
    x_daubo_internal_key: Annotated[str | None, Header(alias="X-Daubo-Internal-Key")] = None,
) -> None:
    """When DAUBO_INTERNAL_API_SECRET is set, require matching header (BFF / server-to-server)."""
    expected = get_settings().internal_api_secret
    if not expected:
        return
    if not x_daubo_internal_key or x_daubo_internal_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing internal API key")
