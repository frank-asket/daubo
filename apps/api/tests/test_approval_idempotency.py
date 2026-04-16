"""Fingerprint tests for approval idempotency (Redis integration tested in staging)."""

from uuid import UUID

from backend.app.services.approval_idempotency import (
    approval_approve_fingerprint,
    approval_reject_fingerprint,
)


def test_approve_fingerprint_stable_for_same_payload():
    aid = UUID("12345678-1234-5678-1234-567812345678")
    a = approval_approve_fingerprint(
        aid, cover_letter="hello", linkedin_note=None
    )
    b = approval_approve_fingerprint(
        aid, cover_letter="hello", linkedin_note=None
    )
    assert a == b


def test_approve_fingerprint_changes_with_body():
    aid = UUID("12345678-1234-5678-1234-567812345678")
    a = approval_approve_fingerprint(
        aid, cover_letter="a", linkedin_note=None
    )
    b = approval_approve_fingerprint(
        aid, cover_letter="b", linkedin_note=None
    )
    assert a != b


def test_reject_fingerprint_includes_approval_id():
    a = approval_reject_fingerprint(UUID("00000000-0000-0000-0000-000000000001"))
    b = approval_reject_fingerprint(UUID("00000000-0000-0000-0000-000000000002"))
    assert a != b
