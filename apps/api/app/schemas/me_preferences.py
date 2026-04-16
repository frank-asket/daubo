from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserPreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_role: str | None = None
    location_preference: str | None = None
    min_salary_usd: int | None = None
    seniority: str | None = None
    skills_highlight: str | None = None
    updated_at: datetime | None = None


class UserPreferencesPatch(BaseModel):
    target_role: str | None = Field(default=None, max_length=300)
    location_preference: str | None = Field(default=None, max_length=300)
    min_salary_usd: int | None = Field(default=None, ge=0, le=2_000_000)
    seniority: str | None = Field(default=None, max_length=64)
    skills_highlight: str | None = Field(default=None, max_length=5_000)
