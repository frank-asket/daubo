from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class ApplicationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    company: str | None = Field(default=None, min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=300)
    status: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=50_000)
    job_url: str | None = Field(default=None, max_length=2000)


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
    created_at: datetime
    updated_at: datetime
