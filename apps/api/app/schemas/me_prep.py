from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.schemas.me import ApplicationOut


class PrepSessionOut(BaseModel):
    id: UUID | None = Field(
        default=None,
        description="Unset when only legacy job_applications.interview_prep exists (no session row).",
    )
    application_id: UUID
    payload: dict[str, Any]
    created_at: datetime | None = None


class PrepGenerateIn(BaseModel):
    application_id: UUID


class PrepGenerateOut(BaseModel):
    application: ApplicationOut
    prep_session_id: UUID
