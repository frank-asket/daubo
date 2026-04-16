"""Request/response models for Gmail, workspace settings, and autopilot (me_ops router)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GmailOAuthCompleteIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=4096)


class GmailStatusOut(BaseModel):
    configured: bool = Field(
        ...,
        description="Server has Google OAuth client id/secret and redirect URI set.",
    )
    connected: bool = False
    google_email: str | None = None


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
    retry_scope: str | None = Field(
        default=None,
        pattern="^(failed_only|gmail_failed_only)$",
        description="Optional retry mode using previous run outcomes.",
    )
    source_run_id: UUID | None = Field(
        default=None,
        description="Optional run id to scope retries to; defaults to recent history when omitted.",
    )


class AutopilotRunOut(BaseModel):
    run_id: UUID | None = None
    status: str = "completed"
    processed: int
    gmail_drafts_created: int
    errors: list[str] = Field(default_factory=list)
    fresh_run: bool = Field(
        default=True,
        description="False when this response replays a prior run under the same Idempotency-Key.",
    )
    replayed_at: datetime | None = Field(
        default=None,
        description="When fresh_run is false, timestamp of this replay response.",
    )


class AutopilotProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    clerk_user_id: str
    target_titles: list[str] = Field(default_factory=list)
    target_locations: list[str] = Field(default_factory=list)
    company_blacklist: list[str] = Field(default_factory=list)
    remote_only: bool = True
    salary_floor: int | None = None
    daily_apply_limit: int = 10
    approval_mode: str = Field(default="always_approve")
    is_active: bool = False
    updated_at: datetime | None = None


class AutopilotProfilePatch(BaseModel):
    target_titles: list[str] | None = None
    target_locations: list[str] | None = None
    company_blacklist: list[str] | None = None
    remote_only: bool | None = None
    salary_floor: int | None = Field(default=None, ge=0)
    daily_apply_limit: int | None = Field(default=None, ge=1, le=50)
    approval_mode: str | None = Field(default=None, pattern="^(always_approve|manual_before_submit)$")
    is_active: bool | None = None


class AutopilotRunRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    status: str
    requested_limit: int
    create_gmail_drafts: bool
    processed: int
    gmail_drafts_created: int
    errors: list[str] = Field(default_factory=list)
    started_at: datetime
    finished_at: datetime | None = None
    last_replayed_at: datetime | None = Field(
        default=None,
        description="Last time an idempotent replay returned this run without re-executing work.",
    )


class AutopilotRunItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    clerk_user_id: str
    application_id: UUID | None = None
    title: str
    company: str
    job_url: str | None = None
    status: str
    error: str | None = None
    error_category: str | None = None
    retryable: bool = False
    suggested_action: str | None = None
    latency_ms: int | None = None
    created_at: datetime
    updated_at: datetime
