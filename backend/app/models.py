from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import DateTime

from app.config import get_settings

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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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
