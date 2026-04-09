from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResumeIn(BaseModel):
    content_text: str = Field(..., min_length=1, max_length=500_000)
    file_name: str | None = Field(default=None, max_length=512)


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    content_text: str
    file_name: str | None
    updated_at: datetime


class ResumeUploadOut(ResumeOut):
    """Saved resume plus optional one-shot agent acknowledgement after ingest."""

    agent_reply: str | None = None


class ApplicationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    company: str = Field(..., min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=300)
    status: str = Field(default="draft", max_length=64)
    notes: str | None = Field(default=None, max_length=50_000)
    job_url: str | None = Field(default=None, max_length=2000)
    apply_channel: str | None = Field(
        default=None,
        max_length=32,
        description="linkedin | email | web — optional hint for draft tone",
    )
    job_description: str | None = Field(
        default=None,
        max_length=120_000,
        description="Posting text for tailoring (human-in-the-loop; not auto-submitted).",
    )

    @field_validator("status")
    @classmethod
    def normalize_status_on_create(cls, v: str) -> str:
        if v == "ready":
            return "ready_to_apply"
        return v


class ApplicationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    company: str | None = Field(default=None, min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=300)
    status: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=50_000)
    job_url: str | None = Field(default=None, max_length=2000)
    apply_channel: str | None = Field(default=None, max_length=32)
    job_description: str | None = Field(default=None, max_length=120_000)

    @field_validator("status")
    @classmethod
    def normalize_status_on_update(cls, v: str | None) -> str | None:
        if v == "ready":
            return "ready_to_apply"
        return v


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    title: str
    company: str
    location: str | None
    status: str
    notes: str | None
    job_url: str | None
    apply_channel: str | None
    job_description: str | None
    package_draft: dict[str, Any] | None
    interview_prep: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class ApplicationPackageRequest(BaseModel):
    """Optional overrides when generating paste-ready drafts."""

    job_description: str | None = Field(default=None, max_length=120_000)
    apply_channel: str | None = Field(default=None, max_length=32)


class GmailOAuthCompleteIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=4096)


class GmailStatusOut(BaseModel):
    configured: bool = Field(
        ...,
        description="Server has Google OAuth client id/secret and redirect URI set.",
    )
    connected: bool = False
    google_email: str | None = None


class GmailDraftOut(BaseModel):
    draft_id: str
    gmail_web_url: str = Field(
        ...,
        description="Opens Gmail draft folder in the browser (user completes send).",
    )


class GmailOAuthCompleteOut(BaseModel):
    connected: bool = True
    google_email: str | None = None


class WorkspaceSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    autopilot_enabled: bool = False
    autopilot_auto_gmail_drafts: bool = False
    updated_at: datetime | None = None


class WorkspaceSettingsPatch(BaseModel):
    autopilot_enabled: bool | None = None
    autopilot_auto_gmail_drafts: bool | None = None


class AutopilotRunIn(BaseModel):
    limit: int = Field(default=6, ge=1, le=25)
    create_gmail_drafts: bool | None = Field(
        default=None,
        description="If set, overrides workspace autopilot_auto_gmail_drafts for this run only.",
    )


class AutopilotRunOut(BaseModel):
    processed: int
    gmail_drafts_created: int
    errors: list[str] = Field(default_factory=list)
