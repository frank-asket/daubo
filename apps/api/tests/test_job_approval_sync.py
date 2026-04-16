from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.app.models import JobApproval
from backend.app.services.job_approval_sync import (
    _READY_STATUSES,
    _package_has_usable_draft,
    ensure_pending_approval_for_application,
    sync_pending_approvals_for_user,
)


def test_package_has_usable_draft():
    assert _package_has_usable_draft(None) is False
    assert _package_has_usable_draft({}) is False
    assert _package_has_usable_draft({"cover_letter": "  hi  "}) is True
    assert _package_has_usable_draft({"linkedin_note": "x"}) is True


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class _EnsureSession:
    """First execute: no pending row; add + commit + refresh succeed."""

    def __init__(self):
        self._pass = 0
        self.stored: JobApproval | None = None

    async def execute(self, *_args, **_kwargs):
        self._pass += 1
        if self._pass == 1:
            return _ScalarResult(None)
        return _ScalarResult(self.stored)

    def add(self, row: JobApproval) -> None:
        self.stored = row

    async def commit(self) -> None:
        return None

    async def refresh(self, _row: JobApproval) -> None:
        return None


@pytest.mark.asyncio
async def test_ensure_pending_creates_approval_row():
    app = SimpleNamespace(
        id=uuid4(),
        clerk_user_id="u1",
        status="package_ready",
        apply_channel="email",
        package_draft={"cover_letter": "Hello hiring team"},
    )
    session = _EnsureSession()
    row = await ensure_pending_approval_for_application(session, app)
    assert row is not None
    assert isinstance(row, JobApproval)
    assert row.clerk_user_id == "u1"
    assert row.job_application_id == app.id
    assert row.status == "pending"
    assert row.channel == "email"
    assert "Hello" in row.draft_body


@pytest.mark.asyncio
async def test_sync_pending_only_package_ready_with_draft(monkeypatch: pytest.MonkeyPatch):
    ready_id = uuid4()
    apps = [
        SimpleNamespace(
            id=ready_id,
            clerk_user_id="u1",
            status="package_ready",
            apply_channel=None,
            package_draft={"cover_letter": "A"},
        ),
        SimpleNamespace(
            id=uuid4(),
            clerk_user_id="u1",
            status="draft",
            apply_channel=None,
            package_draft={"cover_letter": "B"},
        ),
    ]
    ensured: list = []

    async def fake_ensure(_session, app):
        ensured.append(app.id)
        return None

    monkeypatch.setattr(
        "backend.app.services.job_approval_sync.ensure_pending_approval_for_application",
        fake_ensure,
    )

    class ListSession:
        async def execute(self, *_a, **_k):
            filtered = [
                a for a in apps if getattr(a, "status", None) in _READY_STATUSES
            ]
            return _RowsResult(filtered)

    await sync_pending_approvals_for_user(ListSession(), "u1")
    assert ready_id in ensured
    assert len(ensured) == 1
