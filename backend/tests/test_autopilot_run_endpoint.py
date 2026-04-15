import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import unittest

from fastapi import HTTPException

from app.routers.me import _autopilot_request_fingerprint, run_prep_autopilot
from app.schemas.me import AutopilotRunIn


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class AutopilotRunEndpointIdempotencyTest(unittest.TestCase):
    def _profile(self):
        return SimpleNamespace(daily_apply_limit=10)

    def _workspace(self):
        return SimpleNamespace(autopilot_auto_gmail_drafts=False)

    def _settings(self):
        return SimpleNamespace(openrouter_api_key="test-key")

    def test_replays_previous_run_on_same_key_same_payload(self) -> None:
        started = datetime.now(timezone.utc) - timedelta(minutes=5)
        prev_run = SimpleNamespace(
            id=uuid4(),
            started_at=started,
            request_fingerprint=_autopilot_request_fingerprint(
                limit=6,
                create_gmail_drafts=False,
                retry_scope=None,
                source_run_id=None,
            ),
            status="completed",
            processed=3,
            gmail_drafts_created=1,
            errors=[],
        )
        session = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(prev_run)))
        with (
            patch("app.routers.me._get_or_create_autopilot_profile", new=AsyncMock(return_value=self._profile())),
            patch(
                "app.routers.me._get_or_create_workspace_settings",
                new=AsyncMock(return_value=self._workspace()),
            ),
        ):
            result = asyncio.run(
                run_prep_autopilot(
                    body=AutopilotRunIn(),
                    user_id="user_123",
                    session=session,  # type: ignore[arg-type]
                    settings=self._settings(),  # type: ignore[arg-type]
                    idempotency_key_header="same-key",
                )
            )
        self.assertEqual(str(result.run_id), str(prev_run.id))
        self.assertEqual(result.status, "completed")
        self.assertEqual(result.processed, 3)
        self.assertEqual(result.gmail_drafts_created, 1)

    def test_conflict_on_same_key_different_payload(self) -> None:
        started = datetime.now(timezone.utc) - timedelta(minutes=5)
        prev_run = SimpleNamespace(
            id=uuid4(),
            started_at=started,
            request_fingerprint="different-fingerprint",
            status="completed",
            processed=2,
            gmail_drafts_created=0,
            errors=[],
        )
        session = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(prev_run)))
        with (
            patch("app.routers.me._get_or_create_autopilot_profile", new=AsyncMock(return_value=self._profile())),
            patch(
                "app.routers.me._get_or_create_workspace_settings",
                new=AsyncMock(return_value=self._workspace()),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    run_prep_autopilot(
                        body=AutopilotRunIn(),
                        user_id="user_123",
                        session=session,  # type: ignore[arg-type]
                        settings=self._settings(),  # type: ignore[arg-type]
                        idempotency_key_header="same-key",
                    )
                )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIsInstance(ctx.exception.detail, dict)
        self.assertEqual(ctx.exception.detail.get("code"), "idempotency_key_reused_with_different_payload")

    def test_conflict_on_same_key_missing_previous_fingerprint(self) -> None:
        started = datetime.now(timezone.utc) - timedelta(minutes=5)
        prev_run = SimpleNamespace(
            id=uuid4(),
            started_at=started,
            request_fingerprint=None,
            status="completed",
            processed=2,
            gmail_drafts_created=0,
            errors=[],
        )
        session = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(prev_run)))
        with (
            patch("app.routers.me._get_or_create_autopilot_profile", new=AsyncMock(return_value=self._profile())),
            patch(
                "app.routers.me._get_or_create_workspace_settings",
                new=AsyncMock(return_value=self._workspace()),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    run_prep_autopilot(
                        body=AutopilotRunIn(),
                        user_id="user_123",
                        session=session,  # type: ignore[arg-type]
                        settings=self._settings(),  # type: ignore[arg-type]
                        idempotency_key_header="same-key",
                    )
                )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIsInstance(ctx.exception.detail, dict)
        self.assertEqual(ctx.exception.detail.get("code"), "idempotency_key_reused_unverifiable_payload")


if __name__ == "__main__":
    unittest.main()

