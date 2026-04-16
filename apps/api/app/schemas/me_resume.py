from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.services.resume_profile_signals import ResumeProfileSignals

PROFILE_DOC_KINDS = frozenset({"certification", "degree", "other"})


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
    agent_reply: str | None = None


class ResumeProfileStoredOut(BaseModel):
    has_resume: bool = False
    signals: ResumeProfileSignals | None = None
    stale: bool = False
    resume_updated_at: datetime | None = None
    profile_extracted_at: datetime | None = None


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


class AgentMatchLatestResponse(BaseModel):
    run: dict | None = None
    created_at: str | None = None

