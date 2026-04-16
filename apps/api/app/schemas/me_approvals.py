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


class ApprovalApproveOut(BaseModel):
    application: ApplicationOut
    gmail_draft: GmailDraftOut | None = None
