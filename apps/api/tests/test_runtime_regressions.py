from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app import main as api_main
from app.services import me_autopilot_helpers as helpers
from backend.app.config import get_settings
from backend.app.deps.security import require_internal_api_key


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _RaceSession:
    def __init__(self, model_cls):
        self._model_cls = model_cls
        self._existing = model_cls(clerk_user_id="u_race")
        self._execute_calls = 0
        self._commit_calls = 0

    async def execute(self, *_args, **_kwargs):
        self._execute_calls += 1
        # First select misses; second select (after IntegrityError) finds existing row.
        if self._execute_calls == 1:
            return _FakeResult(None)
        return _FakeResult(self._existing)

    def add(self, _row):
        return None

    async def commit(self):
        self._commit_calls += 1
        if self._commit_calls == 1:
            raise IntegrityError("insert", {}, Exception("duplicate key"))
        return None

    async def rollback(self):
        return None

    async def refresh(self, _row):
        return None


@pytest.mark.asyncio
async def test_apps_api_lifespan_starts_init_db(monkeypatch: pytest.MonkeyPatch):
    called = {"init": 0, "dispose": 0}

    async def _fake_init_db():
        called["init"] += 1

    async def _fake_dispose():
        called["dispose"] += 1

    monkeypatch.setattr(api_main, "init_db", _fake_init_db)
    monkeypatch.setattr(api_main, "engine", SimpleNamespace(dispose=_fake_dispose))

    async with api_main.lifespan(api_main.app):
        await asyncio.sleep(0)

    assert called["init"] == 1
    assert called["dispose"] == 1


@pytest.mark.asyncio
async def test_workspace_settings_get_or_create_handles_insert_race():
    session = _RaceSession(helpers.UserWorkspaceSettings)
    row = await helpers.get_or_create_workspace_settings(session, "u_race")
    assert row is not None
    assert row.clerk_user_id == "u_race"


@pytest.mark.asyncio
async def test_autopilot_profile_get_or_create_handles_insert_race():
    session = _RaceSession(helpers.UserAutopilotProfile)
    row = await helpers.get_or_create_autopilot_profile(session, "u_race")
    assert row is not None
    assert row.clerk_user_id == "u_race"


@pytest.mark.asyncio
async def test_internal_api_key_dep_uses_backend_settings():
    settings = get_settings()
    original = settings.daubo_internal_api_secret
    try:
        # Ensure dependency reads/writes the backend settings object shape.
        settings.daubo_internal_api_secret = "secret-123"
        await require_internal_api_key(x_daubo_internal_key="secret-123")

        # Empty key disables guard.
        settings.daubo_internal_api_secret = ""
        await require_internal_api_key(x_daubo_internal_key=None)
    finally:
        settings.daubo_internal_api_secret = original
