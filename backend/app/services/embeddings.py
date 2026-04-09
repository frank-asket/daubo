import httpx

from app.config import Settings

JINA_EMBEDDINGS_URL = "https://api.jina.ai/v1/embeddings"


async def jina_embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not settings.jina_api_key:
        raise ValueError("JINA_API_KEY is not set")
    if not texts:
        return []
    payload = {"model": settings.jina_embedding_model, "input": texts}
    headers = {
        "Authorization": f"Bearer {settings.jina_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(JINA_EMBEDDINGS_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    return [item["embedding"] for item in data["data"]]
