from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import DateTime

from .config import get_settings

_settings = get_settings()


class Base(DeclarativeBase):
    pass


class UserResume(Base):
    """Latest resume text per Daubo user (MVP single row per clerk_user_id)."""

    __tablename__ = "user_resumes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Persisted LLM extraction (skills + context); invalidated when content_text changes.
    profile_signals: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    profile_content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    profile_extracted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserProfileDocument(Base):
    """User-uploaded credentials (certifications, degrees, etc.) — text extracted like resumes."""

    __tablename__ = "user_profile_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    doc_kind: Mapped[str] = mapped_column(String(32), index=True)
    label: Mapped[str | None] = mapped_column(String(300), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class AgentMatchRun(Base):
    """Stored output from background agent runs (e.g. auto job-market plan from resume)."""

    __tablename__ = "agent_match_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    kind: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class UserWorkspaceSettings(Base):
    """Per-user automation preferences (prep autopilot; never submits on third-party sites)."""

    __tablename__ = "user_workspace_settings"

    clerk_user_id: Mapped[str] = mapped_column(String(256), primary_key=True)
    autopilot_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    autopilot_auto_gmail_drafts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserPreferences(Base):
    """Per-user job-search preferences used by onboarding and discovery."""

    __tablename__ = "user_preferences"

    clerk_user_id: Mapped[str] = mapped_column(String(256), primary_key=True)
    target_role: Mapped[str | None] = mapped_column(String(300), nullable=True)
    location_preference: Mapped[str | None] = mapped_column(String(300), nullable=True)
    min_salary_usd: Mapped[int | None] = mapped_column(nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(64), nullable=True)
    skills_highlight: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserAutopilotProfile(Base):
    """Per-user apply automation preferences used by future execution workers."""

    __tablename__ = "user_autopilot_profiles"

    clerk_user_id: Mapped[str] = mapped_column(String(256), primary_key=True)
    target_titles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    target_locations: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    company_blacklist: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    remote_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    salary_floor: Mapped[int | None] = mapped_column(nullable=True)
    daily_apply_limit: Mapped[int] = mapped_column(nullable=False, default=10)
    approval_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="always_approve")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class AutopilotRun(Base):
    """Persisted outcomes for each manual or scheduled autopilot run."""

    __tablename__ = "autopilot_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    request_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    requested_limit: Mapped[int] = mapped_column(nullable=False, default=6)
    create_gmail_drafts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processed: Mapped[int] = mapped_column(nullable=False, default=0)
    gmail_drafts_created: Mapped[int] = mapped_column(nullable=False, default=0)
    errors: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AutopilotRunItem(Base):
    """Per-job outcome rows within an autopilot run."""

    __tablename__ = "autopilot_run_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    run_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    application_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(500), nullable=False)
    job_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserGmailCredentials(Base):
    """Refresh token for Gmail API (drafts only — gmail.compose scope)."""

    __tablename__ = "user_gmail_credentials"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    google_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class JobApplication(Base):
    """Tracked job / application row for pipeline UI."""

    __tablename__ = "job_applications"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="draft")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    # Human-in-the-loop apply: optional channel hint (linkedin | email | web).
    apply_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Job description excerpt or full text used to tailor drafts.
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # LLM-generated cover letter, LinkedIn note, checklist, etc. (JSON object).
    package_draft: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # Saved interview prep (questions, topics) after user runs prep workflow.
    interview_prep: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class JobApproval(Base):
    """Human-in-the-loop gate before apply handoff (email draft / LinkedIn note)."""

    __tablename__ = "job_approvals"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    job_application_id: Mapped[UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE"),
        index=True,
    )
    approval_type: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    draft_body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class JobListing(Base):
    """Per-user discovered job listing with cached fit score."""

    __tablename__ = "job_listings"
    __table_args__ = (
        UniqueConstraint("clerk_user_id", "source", "external_id", name="uq_job_listings_user_source_external"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String(256), index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="discover")
    external_id: Mapped[str] = mapped_column(String(512), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    fit_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fit_reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    page_hint: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class DocumentChunk(Base):
    """Arbitrary text chunk with a Jina embedding stored in pgvector."""

    __tablename__ = "document_chunks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(
        Vector(_settings.jina_embedding_dimension),
        nullable=False,
    )
