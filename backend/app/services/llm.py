from langchain_openai import ChatOpenAI

from app.config import Settings


def chat_llm(settings: Settings) -> ChatOpenAI:
    """OpenRouter exposes an OpenAI-compatible API; model ids include provider prefix."""
    return ChatOpenAI(
        model=settings.openrouter_chat_model,
        api_key=settings.openrouter_api_key or None,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": settings.openrouter_http_referer,
            "X-Title": settings.openrouter_app_title,
        },
    )
