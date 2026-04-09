import logging
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("daubo")

# OpenRouter often returns 404 "No endpoints found" for legacy Anthropic slugs.
_OPENROUTER_LEGACY_SLUGS = frozenset(
    {
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-5-sonnet",
        "anthropic/claude-3.5-sonnet:beta",
    }
)
_OPENROUTER_FALLBACK_MODEL = "openai/gpt-4o-mini"


def _replace_legacy_openrouter_model(model_id: str, env_var_name: str) -> str:
    mid = model_id.strip()
    if mid.lower() in {s.lower() for s in _OPENROUTER_LEGACY_SLUGS}:
        logger.warning(
            "%s=%r is not routed on OpenRouter (404). Using %r. "
            "Set a current model id from https://openrouter.ai/models",
            env_var_name,
            mid,
            _OPENROUTER_FALLBACK_MODEL,
        )
        return _OPENROUTER_FALLBACK_MODEL
    return mid


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        ...,
        description="Async SQLAlchemy URL, e.g. postgresql+asyncpg://user:pass@host:5432/db",
    )

    app_environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    openrouter_api_key: str = ""
    openrouter_chat_model: str = Field(
        default="openai/gpt-4o-mini",
        description=(
            "OpenRouter model id (see https://openrouter.ai/models). "
            "Avoid deprecated slugs like anthropic/claude-3.5-sonnet — use a dated id from the site "
            "or a stable default such as openai/gpt-4o-mini."
        ),
    )
    openrouter_vision_model: str = Field(
        default="openai/gpt-4o-mini",
        description="Vision-capable model on OpenRouter for resume images (PNG/JPEG/WebP).",
    )
    openrouter_http_referer: str = "http://localhost:3000"
    openrouter_app_title: str = "Daubo"

    openrouter_temperature: float = Field(
        default=0.35,
        ge=0.0,
        le=2.0,
        description="Sampling temperature for chat + vision via OpenRouter. Lower ≈ more deterministic.",
    )
    openrouter_top_p: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Nucleus sampling (0–1). 1.0 leaves tail mass unconstrained for most providers.",
    )
    openrouter_top_k: int | None = Field(
        default=None,
        ge=0,
        le=500,
        description=(
            "If set, sent to the provider (0 is valid; optional env unset = omit). "
            "Model-dependent; some ignore top_k."
        ),
    )

    jina_api_key: str = ""
    jina_embedding_model: str = "jina-embeddings-v3"
    jina_embedding_dimension: int = 1024

    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_default_country: str = Field(
        default="us",
        description=(
            "Lowercase Adzuna jobs region slug (e.g. us, gb) when resume/infer country is not mapped. "
            "Set empty to skip Adzuna instead of defaulting."
        ),
    )

    google_oauth_client_id: str = Field(
        default="",
        description="Google Cloud OAuth 2.0 Web client ID for Gmail compose (drafts).",
    )
    google_oauth_client_secret: str = Field(
        default="",
        description="Google Cloud OAuth client secret — server-side only.",
    )
    google_oauth_redirect_uri: str = Field(
        default="",
        description=(
            "Authorized redirect URI registered in Google Cloud, e.g. "
            "https://your-app.vercel.app/api/gmail/oauth/callback (must match Next route exactly)."
        ),
    )

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: str = "http://localhost:3000"

    daubo_internal_api_secret: str = Field(
        default="",
        description="If set, requires X-Daubo-Internal-Key on protected routes (use with Vercel BFF proxy).",
    )

    daubo_max_job_applications_per_user: int = Field(
        default=0,
        ge=0,
        description=(
            "Max saved jobs per Clerk user (POST /me/applications). 0 = unlimited. "
            "Use for free-tier caps in production."
        ),
    )

    trusted_hosts: str = Field(
        default="",
        description="Comma-separated hosts for X-Forwarded-* (production). Empty disables TrustedHostMiddleware.",
    )

    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=10, ge=0, le=100)

    expose_openapi: bool = True

    @field_validator("log_level")
    @classmethod
    def log_level_upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("openrouter_chat_model")
    @classmethod
    def openrouter_chat_model_routeable(cls, v: str) -> str:
        return _replace_legacy_openrouter_model(v, "OPENROUTER_CHAT_MODEL")

    @field_validator("openrouter_vision_model")
    @classmethod
    def openrouter_vision_model_routeable(cls, v: str) -> str:
        return _replace_legacy_openrouter_model(v, "OPENROUTER_VISION_MODEL")

    @field_validator("database_url")
    @classmethod
    def database_url_asyncpg(cls, v: str) -> str:
        """Railway/Heroku often set postgres:// or postgresql://; async engine needs +asyncpg."""
        u = v.strip()
        if u.startswith("postgresql+") or u.startswith("postgres+"):  # include other drivers
            return u
        if u.startswith("postgres://"):
            return "postgresql+asyncpg://" + u[len("postgres://") :]
        if u.startswith("postgresql://"):
            return "postgresql+asyncpg://" + u[len("postgresql://") :]
        return u

    @property
    def is_production(self) -> bool:
        return self.app_environment == "production"

    @property
    def internal_api_secret(self) -> str:
        """Alias for readability."""
        return self.daubo_internal_api_secret

    def cors_origin_list(self) -> list[str]:
        raw = [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]
        if self.is_production and "*" in raw:
            raise ValueError("Wildcard CORS is not allowed when APP_ENVIRONMENT=production")
        return raw

    def trusted_host_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
