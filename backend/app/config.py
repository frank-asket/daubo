from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    openrouter_chat_model: str = "anthropic/claude-3.5-sonnet"
    openrouter_http_referer: str = "http://localhost:3000"
    openrouter_app_title: str = "Daubo"

    jina_api_key: str = ""
    jina_embedding_model: str = "jina-embeddings-v3"
    jina_embedding_dimension: int = 1024

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: str = "http://localhost:3000"

    daubo_internal_api_secret: str = Field(
        default="",
        description="If set, requires X-Daubo-Internal-Key on protected routes (use with Vercel BFF proxy).",
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
