from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.schemas.me import ApplicationOut, GmailDraftOut


class ApprovalQueueItemOut(BaseModel):
    id: UUID
    application_id: UUID
    title: str
    company: str
    location: str | None = None
    apply_channel: str | None = None
    notes: str | None = None
    job_url: str | None = None
    approval_type: str
    channel: str
    draft_body: str
    package_draft: dict[str, Any] | None = None
    application_status: str


class ApprovalApproveIn(BaseModel):
    cover_letter: str | None = Field(default=None, max_length=120_000)
    linkedin_note: str | None = Field(default=None, max_length=12_000)


class LinkedInHandoffOut(BaseModel):
    """Post-approval payload for LinkedIn — user pastes manually; Daubo does not auto-send."""

    note_text: str
    context_line: str = Field(
        ...,
        description="Role + company line for orientation when pasting on LinkedIn.",
    )
    job_url: str | None = None


class ApprovalApproveOut(BaseModel):
    application: ApplicationOut
    gmail_draft: GmailDraftOut | None = None
    gmail_warning: str | None = Field(
        default=None,
        description="Set when Gmail was expected but draft creation failed; user should reconnect or retry.",
    )
    linkedin_handoff: LinkedInHandoffOut | None = None
