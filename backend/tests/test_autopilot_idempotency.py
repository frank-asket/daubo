from datetime import datetime, timedelta, timezone
import unittest

from app.routers.me import (
    _autopilot_idempotency_active,
    _autopilot_idempotency_decision,
)


class AutopilotIdempotencyTest(unittest.TestCase):
    def test_decision_replay_on_matching_fingerprint(self) -> None:
        d = _autopilot_idempotency_decision(
            previous_fingerprint="abc123",
            request_fingerprint="abc123",
        )
        self.assertEqual(d, "replay")

    def test_decision_conflict_on_mismatched_fingerprint(self) -> None:
        d = _autopilot_idempotency_decision(
            previous_fingerprint="abc123",
            request_fingerprint="xyz999",
        )
        self.assertEqual(d, "conflict_mismatch")

    def test_decision_conflict_when_previous_fingerprint_missing(self) -> None:
        self.assertEqual(
            _autopilot_idempotency_decision(previous_fingerprint=None, request_fingerprint="abc123"),
            "conflict_unverifiable",
        )
        self.assertEqual(
            _autopilot_idempotency_decision(previous_fingerprint="", request_fingerprint="abc123"),
            "conflict_unverifiable",
        )
        self.assertEqual(
            _autopilot_idempotency_decision(previous_fingerprint="   ", request_fingerprint="abc123"),
            "conflict_unverifiable",
        )

    def test_idempotency_ttl_active_and_expired(self) -> None:
        fresh = datetime.now(timezone.utc) - timedelta(minutes=20)
        old = datetime.now(timezone.utc) - timedelta(hours=24)
        self.assertTrue(_autopilot_idempotency_active(fresh))
        self.assertFalse(_autopilot_idempotency_active(old))


if __name__ == "__main__":
    unittest.main()

