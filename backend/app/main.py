import logging
import sys
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.db import engine, init_db
from app.deps.security import require_internal_api_key
from app.middleware.request_context import RequestContextMiddleware
from app.routers import chat, chunks, embeddings, health, jobs, me

logger = logging.getLogger("daubo")


def _configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        stream=sys.stdout,
        force=True,
    )


_configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Daubo API (env=%s)", settings.app_environment)
    if settings.is_production and not settings.daubo_internal_api_secret:
        logger.warning(
            "DAUBO_INTERNAL_API_SECRET is empty in production — API is open to anyone who can reach it. "
            "Set the secret and call through your Next.js proxy."
        )
    await init_db()
    logger.info("Database initialized")
    yield
    await engine.dispose()
    logger.info("Database connections closed")


def create_app() -> FastAPI:
    s = get_settings()
    docs_url = "/docs" if s.expose_openapi else None
    redoc_url = "/redoc" if s.expose_openapi else None
    openapi_url = "/openapi.json" if s.expose_openapi else None

    app = FastAPI(
        title="Daubo API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Daubo-Internal-Key",
            "X-Daubo-User-Id",
        ],
        expose_headers=["X-Request-ID"],
    )

    trusted = s.trusted_host_list()
    if trusted:
        from starlette.middleware.trustedhost import TrustedHostMiddleware

        app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted)

    @app.exception_handler(StarletteHTTPException)
    async def http_exc_handler(request: Request, exc: StarletteHTTPException):
        rid = getattr(request.state, "request_id", None)
        detail = exc.detail
        if not isinstance(detail, (str, dict, list)):
            detail = str(detail)
        body: dict = {"detail": detail}
        if rid:
            body["request_id"] = rid
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        rid = getattr(request.state, "request_id", None)
        content = {
            "detail": exc.errors(),
            "message": "Validation error",
        }
        if rid:
            content["request_id"] = rid
        return JSONResponse(status_code=422, content=content)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        rid = getattr(request.state, "request_id", None)
        logger.exception("Unhandled error: %s", exc, extra={"request_id": rid})
        payload = {"detail": "Internal server error"}
        if rid:
            payload["request_id"] = rid
        if not s.is_production:
            payload["error"] = repr(exc)
        return JSONResponse(status_code=500, content=payload)

    @app.get("/health", tags=["health"])
    async def load_balancer_health():
        return {"status": "ok", "service": "daubo-api"}

    protected = [Depends(require_internal_api_key)] if s.daubo_internal_api_secret else []

    app.include_router(health.router, prefix="/v1")
    app.include_router(chat.router, prefix="/v1", dependencies=protected)
    app.include_router(embeddings.router, prefix="/v1", dependencies=protected)
    app.include_router(chunks.router, prefix="/v1", dependencies=protected)
    app.include_router(jobs.router, prefix="/v1", dependencies=protected)
    app.include_router(me.router, prefix="/v1", dependencies=protected)

    return app


app = create_app()
