from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.routers.jobs import _jobs_stream_snapshot, jobs_stream
from app.routers.me_applications import _applications_stream_snapshot, applications_stream
from backend.app.routers.me_status import agents_status_stream
from backend.app.schemas.me import AgentStatusItemOut, AgentStatusOut


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


@pytest.mark.asyncio
async def test_applications_stream_second_chunk_is_ping_when_snapshot_unchanged(monkeypatch):
    async def _fast_sleep(_seconds: float):
        return None

    monkeypatch.setattr("app.routers.me_applications.asyncio.sleep", _fast_sleep)
    now = datetime(2026, 4, 17, 14, 0, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[4, now, 4, now],
        execute_rows=[[("draft", 3), ("applied", 1)], [("draft", 3), ("applied", 1)]],
    )

    response = await applications_stream(user_id="u_stream", session=session)
    _ = await anext(response.body_iterator)  # first chunk: pipeline_update
    second = await anext(response.body_iterator)
    text = second.decode("utf-8") if isinstance(second, (bytes, bytearray)) else str(second)
    assert "event: ping" in text
    await response.body_iterator.aclose()


@pytest.mark.asyncio
async def test_jobs_stream_second_chunk_is_ping_when_snapshot_unchanged(monkeypatch):
    async def _fast_sleep(_seconds: float):
        return None

    monkeypatch.setattr("app.routers.jobs.asyncio.sleep", _fast_sleep)
    discovered_at = datetime(2026, 4, 17, 14, 15, tzinfo=timezone.utc)
    session = _FakeSession(
        scalar_values=[9, discovered_at, 4, 9, discovered_at, 4],
        execute_rows=[],
    )

    response = await jobs_stream(user_id="u_stream", session=session)
    _ = await anext(response.body_iterator)  # first chunk: discovery_update
    second = await anext(response.body_iterator)
    text = second.decode("utf-8") if isinstance(second, (bytes, bytearray)) else str(second)
    assert "event: ping" in text
    await response.body_iterator.aclose()


@pytest.mark.asyncio
async def test_sse_stream_headers_are_set_for_proxy_safety():
    now = datetime(2026, 4, 17, 14, 45, tzinfo=timezone.utc)
    app_session = _FakeSession(
        scalar_values=[1, now],
        execute_rows=[[("draft", 1)]],
    )
    jobs_session = _FakeSession(
        scalar_values=[2, now, 1],
        execute_rows=[],
    )

    app_res = await applications_stream(user_id="u_stream", session=app_session)
    jobs_res = await jobs_stream(user_id="u_stream", session=jobs_session)

    assert app_res.headers["Cache-Control"] == "no-cache"
    assert app_res.headers["Connection"] == "keep-alive"
    assert app_res.headers["X-Accel-Buffering"] == "no"
    assert jobs_res.headers["Cache-Control"] == "no-cache"
    assert jobs_res.headers["Connection"] == "keep-alive"
    assert jobs_res.headers["X-Accel-Buffering"] == "no"

    await app_res.body_iterator.aclose()
    await jobs_res.body_iterator.aclose()


@pytest.mark.asyncio
async def test_agents_status_stream_first_chunk_has_agent_status_event(monkeypatch):
    async def _fake_status(**_kwargs):
        return AgentStatusOut(
            last_orchestration_at=datetime(2026, 4, 17, 15, 0, tzinfo=timezone.utc),
            agents=[
                AgentStatusItemOut(
                    agent_id="discovery_agent",
                    name="Discovery agent",
                    description="Scans role opportunities",
                    state="active",
                    last_run_at=datetime(2026, 4, 17, 15, 0, tzinfo=timezone.utc),
                )
            ],
        )

    monkeypatch.setattr("backend.app.routers.me_status._build_agent_status", _fake_status)
    response = await agents_status_stream(user_id="u_stream", session=None, settings=None)
    first = await anext(response.body_iterator)
    text = first.decode("utf-8") if isinstance(first, (bytes, bytearray)) else str(first)
    assert "event: agent_status" in text
    assert "data:" in text
    assert '"agent_id": "discovery_agent"' in text
    assert response.headers["Cache-Control"] == "no-cache"
    assert response.headers["Connection"] == "keep-alive"
    assert response.headers["X-Accel-Buffering"] == "no"
    await response.body_iterator.aclose()


@pytest.mark.asyncio
async def test_agents_status_stream_second_chunk_ping_when_unchanged(monkeypatch):
    async def _fake_sleep(_seconds: float):
        return None

    async def _fake_status(**_kwargs):
        return AgentStatusOut(
            last_orchestration_at=datetime(2026, 4, 17, 15, 0, tzinfo=timezone.utc),
            agents=[
                AgentStatusItemOut(
                    agent_id="discovery_agent",
                    name="Discovery agent",
                    description="Scans role opportunities",
                    state="active",
                    last_run_at=datetime(2026, 4, 17, 15, 0, tzinfo=timezone.utc),
                )
            ],
        )

    monkeypatch.setattr("backend.app.routers.me_status._build_agent_status", _fake_status)
    monkeypatch.setattr("backend.app.routers.me_status.asyncio.sleep", _fake_sleep)
    response = await agents_status_stream(user_id="u_stream", session=None, settings=None)
    _ = await anext(response.body_iterator)  # first chunk: agent_status
    second = await anext(response.body_iterator)
    text = second.decode("utf-8") if isinstance(second, (bytes, bytearray)) else str(second)
    assert "event: ping" in text
    await response.body_iterator.aclose()
