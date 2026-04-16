from typing import Annotated

from fastapi import Header, HTTPException


async def get_clerk_user_id(
    x_daubo_user_id: Annotated[str | None, Header(alias="X-Daubo-User-Id")] = None,
) -> str:
    if not x_daubo_user_id or not x_daubo_user_id.strip():
        raise HTTPException(status_code=401, detail="Missing X-Daubo-User-Id")
    return x_daubo_user_id.strip()

