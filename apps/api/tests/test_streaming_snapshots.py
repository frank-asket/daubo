from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.routers.jobs import _jobs_stream_snapshot, jobs_stream
from app.routers.me_applications import _applications_stream_snapshot, applications_stream


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class _FakeSession:
    def __init__(self, scalar_values, execute_rows):
        self._scalar_values = list(scalar_values)
        self._execute_rows = list(execute_rows)

    async def scalar(self, *_args, **_kwargs):
        if not self._scalar_values:
            raise AssertionError("No scalar values left for fake session")
        return self._scalar_values.pop(0)

    async def execute(self, *_args, **_kwargs):
        if not self._execute_rows:
            raise AssertionError("No execute rows left for fake session")
        return _RowsResult(self._execute_rows.pop(0))


@pytest.mark.asyncio
async def test_applications_stream_snapshot_shape():
    now = datetime(2026, 4, 17, 12, 0, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[7, now],
        execute_rows=[[("draft", 2), ("applied", 4), ("interview", 1)]],
    )

    out = await _applications_stream_snapshot(session, "u_stream")

    assert out["total"] == 7
    assert out["max_updated_at"] == now.isoformat()
    assert out["by_status"] == {"draft": 2, "applied": 4, "interview": 1}


@pytest.mark.asyncio
async def test_jobs_stream_snapshot_shape():
    discovered_at = datetime(2026, 4, 17, 12, 30, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[11, discovered_at, 5],
        execute_rows=[],
    )

    out = await _jobs_stream_snapshot(session, "u_stream")

    assert out["total"] == 11
    assert out["high_fit"] == 5
    assert out["max_discovered_at"] == discovered_at.isoformat()


@pytest.mark.asyncio
async def test_applications_stream_first_chunk_has_pipeline_event():
    now = datetime(2026, 4, 17, 13, 0, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[3, now],
        execute_rows=[[("draft", 2), ("applied", 1)]],
    )

    response = await applications_stream(user_id="u_stream", session=session)
    first = await anext(response.body_iterator)
    text = first.decode("utf-8") if isinstance(first, (bytes, bytearray)) else str(first)
    assert "event: pipeline_update" in text
    assert "data:" in text
    await response.body_iterator.aclose()


@pytest.mark.asyncio
async def test_jobs_stream_first_chunk_has_discovery_event():
    discovered_at = datetime(2026, 4, 17, 13, 30, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[9, discovered_at, 4],
        execute_rows=[],
    )

    response = await jobs_stream(user_id="u_stream", session=session)
    first = await anext(response.body_iterator)
    text = first.decode("utf-8") if isinstance(first, (bytes, bytearray)) else str(first)
    assert "event: discovery_update" in text
    assert "data:" in text
    await response.body_iterator.aclose()
