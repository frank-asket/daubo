"""Unit tests for post-approval apply handoff helpers."""

from backend.app.services.apply_agent import build_linkedin_handoff_payload


def test_build_linkedin_handoff_prefers_note():
    p = build_linkedin_handoff_payload(
        title="Engineer",
        company="Acme",
        job_url="https://example.com/job",
        package_draft={"linkedin_note": "  Hello  ", "cover_letter": "ignored"},
    )
    assert p is not None
    assert p["note_text"] == "Hello"
    assert p["job_url"] == "https://example.com/job"
    assert p["context_line"] == "Engineer — Acme"


def test_build_linkedin_handoff_falls_back_to_cover():
    p = build_linkedin_handoff_payload(
        title="PM",
        company="Beta",
        job_url=None,
        package_draft={"cover_letter": "Cover only"},
    )
    assert p is not None
    assert p["note_text"] == "Cover only"
    assert p["job_url"] is None


def test_build_linkedin_handoff_empty():
    assert build_linkedin_handoff_payload(
        title="X",
        company="Y",
        job_url=None,
        package_draft={},
    ) is None
