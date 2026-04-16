from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.resume_profile_signals import ResumeProfileSignals


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


class ResumeProfileStoredOut(BaseModel):
    """Cached résumé skills + context for dashboards (persisted on ingest)."""

    has_resume: bool = False
    signals: ResumeProfileSignals | None = None
    stale: bool = False
    resume_updated_at: datetime | None = None
    profile_extracted_at: datetime | None = None


PROFILE_DOC_KINDS = frozenset({"certification", "degree", "other"})


class ProfileDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    doc_kind: str = Field(..., max_length=32)
    label: str | None = Field(default=None, max_length=300)
    file_name: str | None = Field(default=None, max_length=512)
    content_text: str = Field(..., max_length=500_000)
    created_at: datetime
    updated_at: datetime


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


class ApplicationsIntegrityIn(BaseModel):
    dry_run: bool = Field(
        default=True,
        description="Preview changes only when true; apply dedupe/normalization when false.",
    )
    stale_days: int = Field(
        default=21,
        ge=1,
        le=365,
        description="Rows older than this threshold are flagged as stale in the report.",
    )


class ApplicationsIntegrityChange(BaseModel):
    application_id: UUID
    action: str
    reason: str
    before: str | None = None
    after: str | None = None
    duplicate_of_id: UUID | None = None


class ApplicationsIntegrityOut(BaseModel):
    dry_run: bool = True
    stale_days: int
    scanned: int
    duplicates_found: int
    duplicates_removed: int
    statuses_normalized: int
    stale_flagged: int
    changes: list[ApplicationsIntegrityChange] = Field(default_factory=list)


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


class AgentStatusItemOut(BaseModel):
    agent_id: str = Field(..., max_length=64, description="Stable identifier for the agent")
    name: str = Field(..., max_length=128)
    description: str = Field(..., max_length=240)
    state: str = Field(
        ...,
        pattern="^(active|working|idle)$",
        description="UI status indicator (not a hard guarantee of background execution)",
    )
    last_run_at: datetime | None = Field(
        default=None,
        description="Most recent timestamp associated with this agent's work for the user",
    )


class AgentStatusOut(BaseModel):
    last_orchestration_at: datetime | None = None
    agents: list[AgentStatusItemOut] = Field(default_factory=list)


class MeStatsCareerOut(BaseModel):
    ready_to_submit: int
    package_ready: int
    exploring: int
    applied_or_interview: int


class MeStatsOnboardingOut(BaseModel):
    resume_added: bool
    job_saved: bool
    gmail_connected: bool
    setup_complete: bool


class MeStatsLimitsOut(BaseModel):
    max_tracked_jobs: int | None
    tracked_jobs: int


class MeStatsAgentsOut(BaseModel):
    openrouter_configured: bool
    tavily_configured: bool
    job_web_search_copilot: bool


class MeStatsOut(BaseModel):
    application_count: int
    has_resume: bool
    career: MeStatsCareerOut
    onboarding: MeStatsOnboardingOut
    limits: MeStatsLimitsOut
    agents: MeStatsAgentsOut
