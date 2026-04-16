from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers import me_ops
from app.schemas.me_ops import AutopilotRunIn


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    async def execute(self, *_args, **_kwargs):
        prev = SimpleNamespace(
            id=uuid4(),
            started_at=datetime.now(timezone.utc),
            request_fingerprint="some-other-fingerprint",
            status="completed",
            processed=0,
            gmail_drafts_created=0,
            errors=[],
        )
        return _FakeResult(prev)


@pytest.mark.asyncio
async def test_idempotency_conflict_happens_before_lock(monkeypatch: pytest.MonkeyPatch):
    async def _profile(*_args, **_kwargs):
        return SimpleNamespace(daily_apply_limit=10)

    async def _ws(*_args, **_kwargs):
        return SimpleNamespace(autopilot_auto_gmail_drafts=False)

    async def _lock(*_args, **_kwargs):
        raise AssertionError("overlap lock should not be requested on idempotency mismatch")

    monkeypatch.setattr(me_ops, "get_or_create_autopilot_profile", _profile)
    monkeypatch.setattr(me_ops, "get_or_create_workspace_settings", _ws)
    monkeypatch.setattr(me_ops, "acquire_autopilot_overlap_lock", _lock)

    with pytest.raises(HTTPException) as err:
        await me_ops.run_prep_autopilot(
            body=AutopilotRunIn(limit=6),
            user_id="u_test",
            session=_FakeSession(),
            settings=SimpleNamespace(redis_url="redis://localhost:6379/0"),
            idempotency_key_header="idem-1",
        )

    assert err.value.status_code == 409
    detail = err.value.detail if isinstance(err.value.detail, dict) else {}
    assert detail.get("code") == "idempotency_key_reused_with_different_payload"
