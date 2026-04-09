from langchain_openai import ChatOpenAI

from app.config import Settings


def chat_llm(settings: Settings) -> ChatOpenAI:
    """OpenRouter exposes an OpenAI-compatible API; model ids include provider prefix."""
    model_kwargs: dict = {}
    if settings.openrouter_top_k is not None:
        model_kwargs["top_k"] = settings.openrouter_top_k

    kwargs: dict = {
        "model": settings.openrouter_chat_model,
        "api_key": settings.openrouter_api_key or None,
        "base_url": "https://openrouter.ai/api/v1",
        "default_headers": {
            "HTTP-Referer": settings.openrouter_http_referer,
            "X-Title": settings.openrouter_app_title,
        },
        "temperature": settings.openrouter_temperature,
        "top_p": settings.openrouter_top_p,
    }
    if model_kwargs:
        kwargs["model_kwargs"] = model_kwargs
    return ChatOpenAI(**kwargs)
