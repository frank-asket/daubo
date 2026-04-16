import sys
from pathlib import Path

from fastapi import FastAPI

# During migration, apps/api reuses the existing backend implementation.
# This avoids code drift while we progressively move backend modules into apps/api.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_LEGACY_BACKEND = _REPO_ROOT / "backend"
if str(_LEGACY_BACKEND) not in sys.path:
    sys.path.insert(0, str(_LEGACY_BACKEND))

try:
    from backend.app.main import app as legacy_app
except Exception:
    legacy_app = FastAPI(title="Daubo API (migration scaffold)")

    @legacy_app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "api"}

app = legacy_app
