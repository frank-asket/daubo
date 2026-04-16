"""Migration wrapper for Gmail integration helpers."""

from backend.app.services.gmail_integration import (
    create_draft_plain,
    draft_content_from_application,
    gmail_oauth_configured,
)

__all__ = [
    "create_draft_plain",
    "draft_content_from_application",
    "gmail_oauth_configured",
]

