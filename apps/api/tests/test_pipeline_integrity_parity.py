from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.app.services.pipeline_integrity import run_pipeline_integrity_pass


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class _FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.deleted_ids: list[str] = []
        self.commit_calls = 0

    async def execute(self, *_args, **_kwargs):
        return _ScalarResult(self.rows)

    async def delete(self, row):
        self.deleted_ids.append(str(row.id))

    async def commit(self):
        self.commit_calls += 1


def _row(**overrides):
    base = {
        "id": uuid4(),
        "title": "Senior Backend Engineer",
        "company": "Daubo Labs",
        "location": "Paris",
        "status": "ready",
        "notes": None,
        "job_url": "https://example.com/jobs/1",
        "apply_channel": None,
        "job_description": None,
        "package_draft": None,
        "interview_prep": None,
        "updated_at": datetime.now(timezone.utc) - timedelta(days=40),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_integrity_dry_run_and_apply_have_matching_duplicate_signal():
    keeper = _row(status="ready")
    duplicate = _row(status="applied", id=uuid4())
    duplicate.job_url = keeper.job_url

    dry_run_session = _FakeSession([keeper, duplicate])
    dry_run = await run_pipeline_integrity_pass(
        dry_run_session,
        "u_test",
        dry_run=True,
        stale_days=21,
    )
    assert dry_run["duplicates_found"] == 1
    assert dry_run["duplicates_removed"] == 0
    assert dry_run["statuses_normalized"] >= 1
    assert dry_run_session.commit_calls == 0

    keeper2 = _row(id=keeper.id, status="ready")
    duplicate2 = _row(id=duplicate.id, status="applied")
    duplicate2.job_url = keeper2.job_url
    apply_session = _FakeSession([keeper2, duplicate2])
    apply_out = await run_pipeline_integrity_pass(
        apply_session,
        "u_test",
        dry_run=False,
        stale_days=21,
    )
    assert apply_out["duplicates_found"] == dry_run["duplicates_found"]
    assert apply_out["duplicates_removed"] == 1
    assert apply_session.commit_calls == 1
    assert str(duplicate2.id) in apply_session.deleted_ids
    assert keeper2.status == "applied"
