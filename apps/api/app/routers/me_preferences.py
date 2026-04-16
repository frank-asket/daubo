from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.users import get_clerk_user_id
from app.schemas.me_preferences import UserPreferencesOut, UserPreferencesPatch
from backend.app.db import get_db
from backend.app.models import UserPreferences

router = APIRouter(tags=["me"])


async def _get_or_create_preferences(session: AsyncSession, user_id: str) -> UserPreferences:
    result = await session.execute(
        select(UserPreferences).where(UserPreferences.clerk_user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row
    row = UserPreferences(clerk_user_id=user_id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


@router.get("/me/preferences", response_model=UserPreferencesOut)
async def get_preferences(
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserPreferences:
    return await _get_or_create_preferences(session, user_id)


@router.patch("/me/preferences", response_model=UserPreferencesOut)
async def patch_preferences(
    body: UserPreferencesPatch,
    user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserPreferences:
    row = await _get_or_create_preferences(session, user_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row
