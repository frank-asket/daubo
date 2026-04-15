from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
import unittest

from app.routers.me import _autopilot_conflict_detail, _is_autopilot_run_stale
from app.services.autopilot import _retry_application_ids_for_scope


class AutopilotReliabilityHelpersTest(unittest.TestCase):
    def test_retry_scope_failed_only(self) -> None:
        app_a = uuid4()
        app_b = uuid4()
        rows = [
            SimpleNamespace(application_id=app_a, status="failed"),
            SimpleNamespace(application_id=app_b, status="prepared_draft_failed"),
            SimpleNamespace(application_id=None, status="failed"),
        ]
        ids = _retry_application_ids_for_scope(rows, "failed_only")  # type: ignore[arg-type]
        self.assertEqual(ids, {app_a})

    def test_retry_scope_gmail_failed_only(self) -> None:
        app_a = uuid4()
        app_b = uuid4()
        rows = [
            SimpleNamespace(application_id=app_a, status="failed"),
            SimpleNamespace(application_id=app_b, status="prepared_draft_failed"),
        ]
        ids = _retry_application_ids_for_scope(rows, "gmail_failed_only")  # type: ignore[arg-type]
        self.assertEqual(ids, {app_b})

    def test_retry_scope_unknown(self) -> None:
        rows = [SimpleNamespace(application_id=uuid4(), status="failed")]
        ids = _retry_application_ids_for_scope(rows, None)  # type: ignore[arg-type]
        self.assertEqual(ids, set())

    def test_is_autopilot_run_stale(self) -> None:
        fresh = datetime.now(timezone.utc) - timedelta(minutes=2)
        old = datetime.now(timezone.utc) - timedelta(hours=2)
        self.assertFalse(_is_autopilot_run_stale(fresh))
        self.assertTrue(_is_autopilot_run_stale(old))

    def test_autopilot_conflict_detail_shape(self) -> None:
        run_id = uuid4()
        started_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        running = SimpleNamespace(id=run_id, started_at=started_at)
        detail = _autopilot_conflict_detail(running)  # type: ignore[arg-type]
        self.assertEqual(detail["code"], "autopilot_run_in_progress")
        self.assertEqual(detail["active_run_id"], str(run_id))
        self.assertIn("message", detail)
        self.assertIn("started_at", detail)


if __name__ == "__main__":
    unittest.main()

