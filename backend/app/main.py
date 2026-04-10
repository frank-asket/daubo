import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
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

    # Run DB setup in the background so HTTP (e.g. Railway /health) can respond immediately.
    # A blocking await init_db() before yield prevents the server from accepting connections
    # until Postgres is reachable — healthchecks then see "service unavailable" indefinitely.
    async def _init_db_task():
        await init_db()
        from app.db import db_init_ok

        if db_init_ok:
            logger.info("Database initialized")

    init_task = asyncio.create_task(_init_db_task())
    try:
        yield
    finally:
        if not init_task.done():
            init_task.cancel()
        try:
            await init_task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass  # already logged inside _init_db_task
        await engine.dispose()
        logger.info("Database connections closed")


def _mount_job_search_ag_ui(app: FastAPI, settings: Settings) -> None:
    if not (
        (settings.openrouter_api_key or "").strip() and (settings.tavily_api_key or "").strip()
    ):
        logger.info("AG-UI job-search agent not mounted (set OPENROUTER_API_KEY and TAVILY_API_KEY)")
        return
    try:
        from ag_ui_langgraph import add_langgraph_fastapi_endpoint
        from copilotkit import LangGraphAGUIAgent

        from app.graph.job_search_agent import build_job_search_graph
    except ImportError as exc:
        logger.warning("AG-UI mount skipped (import): %s", exc)
        return
    try:
        graph = build_job_search_graph(settings)
    except Exception:
        logger.exception("build_job_search_graph failed; AG-UI mount skipped")
        return
    agent = LangGraphAGUIAgent(
        name="daubo_job_search",
        description=(
            "Job scout: reads résumé context, plans searches, calls Tavily, streams tool progress (AG-UI)."
        ),
        graph=graph,
    )
    add_langgraph_fastapi_endpoint(app, agent, path="/v1/ag-ui/job-search")
    logger.info("Mounted AG-UI job-search agent at /v1/ag-ui/job-search")


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
            "Accept",
            "CopilotKit-Version",
        ],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def ag_ui_internal_guard(request: Request, call_next):
        path = request.url.path or ""
        if path.startswith("/v1/ag-ui"):
            expected = get_settings().daubo_internal_api_secret
            if expected:
                got = request.headers.get("X-Daubo-Internal-Key")
                if got != expected:
                    return JSONResponse(
                        {"detail": "Unauthorized"},
                        status_code=401,
                    )
                # BFF must attach Clerk user id (Next.js verifies session before proxying).
                user_id = (request.headers.get("X-Daubo-User-Id") or "").strip()
                if not user_id:
                    return JSONResponse(
                        {"detail": "Missing X-Daubo-User-Id"},
                        status_code=401,
                    )
        return await call_next(request)

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

    for route in app.routes:
        path = getattr(route, "path", "") or ""
        if "/me/resume" not in path:
            continue
        methods = getattr(route, "methods", None)
        if methods:
            logger.info(
                "Mounted resume route %s %s",
                ",".join(sorted(methods)),
                path,
            )

    _mount_job_search_ag_ui(app, s)

    return app


app = create_app()
