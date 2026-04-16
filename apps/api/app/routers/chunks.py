from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import DocumentChunk
from backend.app.services.embeddings import jina_embed

router = APIRouter(tags=["chunks"])


class ChunkCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)
    meta: dict[str, Any] | None = None


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    meta: dict[str, Any] | None


class ChunkSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=1, le=50)


class ChunkSearchHit(BaseModel):
    id: UUID
    text: str
    cosine_distance: float


@router.post("/chunks", response_model=ChunkOut)
async def create_chunk(
    body: ChunkCreate,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ChunkOut:
    if not settings.jina_api_key:
        raise HTTPException(status_code=503, detail="JINA_API_KEY is not configured")
    try:
        vectors = await jina_embed(settings, [body.text])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    row = DocumentChunk(text=body.text, meta=body.meta, embedding=vectors[0])
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return ChunkOut.model_validate(row)


@router.post("/chunks/search", response_model=list[ChunkSearchHit])
async def search_chunks(
    body: ChunkSearchRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[ChunkSearchHit]:
    if not settings.jina_api_key:
        raise HTTPException(status_code=503, detail="JINA_API_KEY is not configured")
    try:
        vectors = await jina_embed(settings, [body.query])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    qvec = vectors[0]
    dist = DocumentChunk.embedding.cosine_distance(qvec)
    stmt = select(DocumentChunk, dist).order_by(dist).limit(body.limit)
    result = await session.execute(stmt)
    return [
        ChunkSearchHit(id=chunk.id, text=chunk.text, cosine_distance=float(d))
        for chunk, d in result.all()
    ]

