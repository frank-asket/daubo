import sys
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# During migration, apps/api reuses the existing backend implementation.
# This avoids code drift while we progressively move backend modules into apps/api.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_LEGACY_BACKEND = _REPO_ROOT / "backend"
if str(_LEGACY_BACKEND) not in sys.path:
    sys.path.insert(0, str(_LEGACY_BACKEND))

from backend.app.config import get_settings
from backend.app.deps.security import require_internal_api_key
from backend.app.routers import me_status

from app.routers import (
    chat,
    chunks,
    embeddings,
    health,
    jobs,
    me_applications,
    me_ops,
    me_preferences,
    me_resume,
)

settings = get_settings()
app = FastAPI(title="Daubo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list() or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

protected = [Depends(require_internal_api_key)] if settings.daubo_internal_api_secret else []
app.include_router(health.router, prefix="/v1")
app.include_router(jobs.router, prefix="/v1", dependencies=protected)
app.include_router(chat.router, prefix="/v1", dependencies=protected)
app.include_router(embeddings.router, prefix="/v1", dependencies=protected)
app.include_router(chunks.router, prefix="/v1", dependencies=protected)
# Migrated /me routes (split routers); shared dashboard routes from backend.app.routers.me_status.
app.include_router(me_resume.router, prefix="/v1", dependencies=protected)
app.include_router(me_applications.router, prefix="/v1", dependencies=protected)
app.include_router(me_ops.router, prefix="/v1", dependencies=protected)
app.include_router(me_preferences.router, prefix="/v1", dependencies=protected)
app.include_router(me_status.router, prefix="/v1", dependencies=protected)
