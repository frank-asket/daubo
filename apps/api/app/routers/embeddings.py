from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import Settings, get_settings
from backend.app.services.embeddings import jina_embed

router = APIRouter(tags=["embeddings"])


class EmbeddingsRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=256)


class EmbeddingsResponse(BaseModel):
    embeddings: list[list[float]]
    dimension: int
    model: str


@router.post("/embeddings", response_model=EmbeddingsResponse)
async def embeddings(
    body: EmbeddingsRequest,
    settings: Settings = Depends(get_settings),
) -> EmbeddingsResponse:
    if not settings.jina_api_key:
        raise HTTPException(status_code=503, detail="JINA_API_KEY is not configured")
    try:
        vectors = await jina_embed(settings, body.texts)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    dim = len(vectors[0]) if vectors else settings.jina_embedding_dimension
    return EmbeddingsResponse(
        embeddings=vectors,
        dimension=dim,
        model=settings.jina_embedding_model,
    )

